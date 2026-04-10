require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { Sequelize, DataTypes } = require('sequelize');
const { google } = require('googleapis');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// Render thường dùng biến DATABASE_URL cho Postgres, nếu bạn đặt tên khác thì sửa lại ở đây
const POSTGRES_URI = process.env.POSTGRES_URI || process.env.DATABASE_URL;
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID;
const CLIENT_ID = process.env.DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.DRIVE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.DRIVE_REFRESH_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-du-phong';

if (!POSTGRES_URI) { 
    console.error("❌ LỖI: Chưa cấu hình POSTGRES_URI hoặc DATABASE_URL trên Render!"); 
}

const DANH_SACH_KHOA = [
    "Khoa Cấp cứu", "Khoa Hồi sức Tích cực và Chống độc", "Khoa Nội Tổng hợp Thần kinh",
    "Khoa Nội Cán bộ", "Khoa Nhi", "Khoa Ngoại Tổng quát", "Khoa Ngoại Thần kinh", "Khoa Ngoại Cột sống",
    "Khoa Phẫu thuật - Gây mê Hồi sức", "Khoa Phụ Sản", "Khoa Tai Mũi Họng", "Khoa Mắt", "Khoa Răng Hàm Mặt",
    "Khoa Vật lý Trị liệu - Phục hồi Chức năng", "Khoa Y học Cổ truyền", "Khoa Ngoại Tiết niệu", 
    "Khoa Đột quỵ", "Khoa Huyết học - Truyền máu", "Khoa Hóa sinh", "Khoa Vi sinh - Ký sinh trùng", 
    "Khoa Chẩn đoán Hình ảnh", "Khoa Giải phẫu bệnh", "Khoa Kiểm soát Nhiễm khuẩn", "Khoa Dược", 
    "Khoa Dinh dưỡng", "Khoa Nội Tim mạch Lão học", "Khoa Tim mạch Can thiệp", "Khoa Ngoại Lồng ngực",
    "Trung tâm Chấn thương Chỉnh hình và Bỏng", "Trung tâm Dịch vụ Y tế"
];

// 🟢 CẤU HÌNH SEQUELIZE TƯƠNG THÍCH RENDER (SSL ON)
const sequelize = new Sequelize(POSTGRES_URI, { 
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false // Bắt buộc cho Render/Heroku
        }
    }
});

// 🟢 MODELS
const DataModel = sequelize.define('HospitalData', {
    id_name: { type: DataTypes.STRING, primaryKey: true },
    currentData: { type: DataTypes.JSONB, defaultValue: {} }
});

const UserModel = sequelize.define('User', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    username: { type: DataTypes.STRING, unique: true, allowNull: false },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.STRING },
    tenKhoa: { type: DataTypes.STRING, allowNull: false }
});

const DeptDataModel = sequelize.define('DeptData', {
    tenKhoa: { type: DataTypes.STRING, unique: true, primaryKey: true }, 
    danhMucQTKT: { type: DataTypes.JSONB, defaultValue: [] },
    daoTaoNganHan: { type: DataTypes.JSONB, defaultValue: [] },
    danhMucPhacDo: { type: DataTypes.JSONB, defaultValue: [] }
});

async function khoiTaoDuLieuGoc() {
    try {
        await sequelize.sync({ alter: true });
        console.log("✅ Đã đồng bộ cấu trúc PostgreSQL");

        for (let ten of DANH_SACH_KHOA) {
            await DeptDataModel.findOrCreate({
                where: { tenKhoa: ten },
                defaults: { tenKhoa: ten, danhMucQTKT: [], daoTaoNganHan: [], danhMucPhacDo: [] }
            });
        }
        
        const adminCount = await UserModel.count({ where: { role: 'admin' } });
        if (adminCount === 0) { 
            await UserModel.create({ 
                username: 'admin', 
                password: '123', 
                role: 'admin', 
                tenKhoa: 'Phòng Kế hoạch tổng hợp' 
            });
            console.log("🚀 Đã tạo tài khoản Admin mặc định: admin / 123");
        }
    } catch (error) {
        console.error("❌ Lỗi Khởi tạo DB:", error.message);
    }
}

// KHỞI ĐỘNG KẾT NỐI
sequelize.authenticate()
    .then(() => { 
        console.log("✅ Đã kết nối PostgreSQL (SSL Mode)"); 
        khoiTaoDuLieuGoc(); 
    })
    .catch(err => console.error("❌ Lỗi kết nối Postgres:", err.message));

let driveService;
try {
    const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, "https://developers.google.com/oauthplayground");
    oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
    driveService = google.drive({ version: 'v3', auth: oauth2Client });
} catch (error) { console.error("❌ Lỗi Drive:", error.message); }

app.use(express.json({ limit: '100mb' }));
app.use(express.static(path.join(__dirname)));

// 🟢 API ĐĂNG NHẬP (ĐÃ THÊM LOG LỖI CHI TIẾT)
app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log(`🔑 Thử đăng nhập: ${username}`);

        const user = await UserModel.findOne({ where: { username, password } });
        
        if (!user) {
            console.log("❌ Sai tài khoản hoặc mật khẩu");
            return res.status(401).json({ message: "Sai tên đăng nhập hoặc mật khẩu!" });
        }

        const token = jwt.sign({ id: user.id, role: user.role, tenKhoa: user.tenKhoa, username: user.username }, JWT_SECRET, { expiresIn: '8h' });
        console.log("✅ Đăng nhập thành công!");
        res.json({ message: "Đăng nhập thành công", token, role: user.role, tenKhoa: user.tenKhoa, username: user.username });
    } catch (error) { 
        console.error("🔥 LỖI SERVER LOGIN:", error.message);
        res.status(500).json({ message: "Lỗi kết nối cơ sở dữ liệu!", details: error.message }); 
    }
});

// Giữ lại các API khác từ code cũ của bạn...
app.get('/api/data', async (req, res) => {
    try { 
        const result = await DataModel.findOne({ where: { id_name: "hospital_main_db" }, raw: true }); 
        const resultICD = await DataModel.findOne({ where: { id_name: "hospital_icd10_db" }, raw: true }); 
        let finalData = result ? result.currentData : { PL1: [], PL2: [], GiaDV: [], MaDVBV: [] };
        finalData.ICD10 = (resultICD && resultICD.currentData && resultICD.currentData.ICD10) ? resultICD.currentData.ICD10 : [];
        res.json(finalData); 
    } catch (error) { res.status(500).json({ message: "Lỗi tải dữ liệu" }); }
});

app.get('/api/dept-data', async (req, res) => {
    try { const allDepts = await DeptDataModel.findAll({ raw: true }); res.json(allDepts); } 
    catch (error) { res.status(500).json({ message: "Lỗi tải dữ liệu" }); }
});

app.post('/api/upload-and-save', upload.single('fileExcel'), async (req, res) => {
    try {
        const tabName = req.body.tabName;
        const tabData = JSON.parse(req.body.tabData);
        let dbName = tabName === 'ICD10' ? "hospital_icd10_db" : "hospital_main_db";
        let existingObj = await DataModel.findOne({ where: { id_name: dbName } });
        let newData = existingObj ? existingObj.currentData : {};
        newData[tabName] = tabData;
        await DataModel.upsert({ id_name: dbName, currentData: newData });
        res.json({ message: `Lưu dữ liệu cho bảng [${tabName}] thành công!` });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống!" }); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(PORT, () => console.log(`📡 Server chạy tại cổng: ${PORT}`));