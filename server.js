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

const POSTGRES_URI = process.env.POSTGRES_URI;
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID;
const CLIENT_ID = process.env.DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.DRIVE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.DRIVE_REFRESH_TOKEN;
const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-du-phong';

if (!POSTGRES_URI) { console.error("❌ LỖI: Chưa cấu hình POSTGRES_URI!"); process.exit(1); }

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

// 🟢 KẾT NỐI POSTGRESQL THÔNG QUA SEQUELIZE
const sequelize = new Sequelize(POSTGRES_URI, { 
    dialect: 'postgres',
    logging: false // Tắt log câu lệnh SQL cho đỡ rối console
});

// 🟢 ĐỊNH NGHĨA CẤU TRÚC BẢNG (Dùng JSONB cực mạnh để thay thế NoSQL)
const DataModel = sequelize.define('HospitalData', {
    id_name: { type: DataTypes.STRING, primaryKey: true },
    currentData: { type: DataTypes.JSONB, defaultValue: {} }
});

const UserModel = sequelize.define('User', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    username: { type: DataTypes.STRING, unique: true, allowNull: false },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.STRING }, // 'admin' hoặc 'khoa'
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
        await sequelize.sync({ alter: true }); // Tự động tạo bảng nếu chưa có
        console.log("✅ Đã đồng bộ cấu trúc PostgreSQL");

        for (let ten of DANH_SACH_KHOA) {
            await DeptDataModel.findOrCreate({
                where: { tenKhoa: ten },
                defaults: { tenKhoa: ten, danhMucQTKT: [], daoTaoNganHan: [], danhMucPhacDo: [] }
            });
        }
        
        const adminCount = await UserModel.count({ where: { role: 'admin' } });
        if (adminCount === 0) { 
            await UserModel.create({ username: 'admin', password: '123', role: 'admin', tenKhoa: 'Phòng Kế hoạch tổng hợp' }); 
        }
    } catch (error) {
        console.error("❌ Lỗi Khởi tạo DB:", error);
    }
}

// Chạy kết nối
sequelize.authenticate()
    .then(() => { console.log("✅ Đã kết nối PostgreSQL thành công!"); khoiTaoDuLieuGoc(); })
    .catch(err => console.error("❌ Lỗi kết nối Postgres:", err));

let driveService;
try {
    const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, "https://developers.google.com/oauthplayground");
    oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });
    driveService = google.drive({ version: 'v3', auth: oauth2Client });
} catch (error) { console.error("❌ Lỗi Drive:", error.message); }

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) { fs.mkdirSync(uploadDir, { recursive: true }); }

const upload = multer({ dest: 'uploads/', limits: { fieldSize: 100 * 1024 * 1024 }});
app.use(express.json({ limit: '100mb' }));
app.use(express.static(path.join(__dirname)));

// 🟢 CÁC API GIỮ NGUYÊN HOẠT ĐỘNG, CHỈ THAY LÕI TÌM KIẾM
app.get('/api/data', async (req, res) => {
    try { 
        const result = await DataModel.findOne({ where: { id_name: "hospital_main_db" }, raw: true }); 
        const resultICD = await DataModel.findOne({ where: { id_name: "hospital_icd10_db" }, raw: true }); 
        
        let finalData = result ? result.currentData : { PL1: [], PL2: [], GiaDV: [], MaDVBV: [] };
        
        if (!finalData.PL1) finalData.PL1 = [];
        if (!finalData.PL2) finalData.PL2 = [];
        if (!finalData.GiaDV) finalData.GiaDV = [];
        if (!finalData.MaDVBV) finalData.MaDVBV = [];
        
        finalData.ICD10 = (resultICD && resultICD.currentData && resultICD.currentData.ICD10) ? resultICD.currentData.ICD10 : [];

        if (finalData.ICD10.length === 0) {
            const icdPath = path.join(__dirname, 'icd10.json');
            if (fs.existsSync(icdPath)) {
                finalData.ICD10 = JSON.parse(fs.readFileSync(icdPath, 'utf8'));
            }
        }

        res.json(finalData); 
    } 
    catch (error) { res.status(500).json({ message: "Lỗi tải dữ liệu" }); }
});

app.post('/api/upload-and-save', upload.single('fileExcel'), async (req, res) => {
    try {
        const tabName = req.body.tabName;
        if (!tabName) return res.status(400).json({ message: "Không xác định được bảng dữ liệu!" });
        const tabData = JSON.parse(req.body.tabData);

        // Lấy db cũ ra để ghép vào
        let dbName = tabName === 'ICD10' ? "hospital_icd10_db" : "hospital_main_db";
        let existingObj = await DataModel.findOne({ where: { id_name: dbName } });
        
        let newData = existingObj ? existingObj.currentData : {};
        newData[tabName] = tabData;

        await DataModel.upsert({ id_name: dbName, currentData: newData });

        if (req.file && driveService && DRIVE_FOLDER_ID) {
            try {
                const fileMetadata = { name: `[Backup_${tabName}] ${Date.now()}_${req.file.originalname}`, parents: [DRIVE_FOLDER_ID] };
                const media = { mimeType: req.file.mimetype, body: fs.createReadStream(req.file.path) };
                await driveService.files.create({ resource: fileMetadata, media: media, fields: 'id' });
                fs.unlinkSync(req.file.path);
            } catch (e) {}
        }
        res.json({ message: `Lưu dữ liệu cho bảng [${tabName}] thành công!` });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống khi lưu. File vượt giới hạn dung lượng!" }); }
});

app.post('/api/upload-dtnh', async (req, res) => {
    try {
        const payload = req.body.payload; 
        const year = req.body.year;
        
        for (let khoa in payload) {
            const dept = await DeptDataModel.findOne({ where: { tenKhoa: khoa } });
            if (dept) {
                let filtered = dept.daoTaoNganHan.filter(item => String(item.nam) !== String(year));
                filtered.push(...payload[khoa]);
                dept.daoTaoNganHan = filtered;
                dept.changed('daoTaoNganHan', true); // Báo cho Sequelize biết JSONB đã thay đổi
                await dept.save();
            }
        }
        res.json({ message: `Đã cập nhật Kế hoạch Đào tạo (Năm ${year}) thành công!` });
    } catch (error) { res.status(500).json({ message: "Lỗi lưu dữ liệu đào tạo." }); }
});

function findItemIndex(danhMuc, targetMa, targetTen, type) {
    let tMa = targetMa ? String(targetMa).trim().toLowerCase() : "";
    let tTen = targetTen ? String(targetTen).trim().toLowerCase() : "";

    return danhMuc.findIndex(item => {
        let iMa = "";
        let iMaLK = "";
        let iTen = "";

        if (type === 'PHAC_DO') {
            iMa = item.maBenh ? String(item.maBenh).trim().toLowerCase() : "";
            iMaLK = item.maBenhKhongDau ? String(item.maBenhKhongDau).trim().toLowerCase() : "";
            iTen = item.tenBenh ? String(item.tenBenh).trim().toLowerCase() : (item.diseaseName ? String(item.diseaseName).trim().toLowerCase() : "");
        } else {
            iMa = item.ma ? String(item.ma).trim().toLowerCase() : "";
            iMaLK = item.maLienKet ? String(item.maLienKet).trim().toLowerCase() : "";
            iTen = item.ten ? String(item.ten).trim().toLowerCase() : "";
        }

        if (tMa !== "" && (iMa === tMa || iMaLK === tMa)) return true;
        if (tTen !== "" && iTen === tTen) return true;
        return false;
    });
}

app.get('/api/dept-data', async (req, res) => {
    try { const allDepts = await DeptDataModel.findAll({ raw: true }); res.json(allDepts); } 
    catch (error) { res.status(500).json({ message: "Lỗi tải dữ liệu" }); }
});

app.post('/api/dept-data/add', async (req, res) => {
    try {
        const { tenKhoa, quyTrinh, type } = req.body; 
        const dept = await DeptDataModel.findOne({ where: { tenKhoa: tenKhoa } });
        if(!dept) return res.status(404).json({ message: "Không tìm thấy dữ liệu khoa" });

        let targetArray = type === 'PHAC_DO' ? [...dept.danhMucPhacDo] : [...dept.danhMucQTKT];
        let maCheck = type === 'PHAC_DO' ? quyTrinh.maBenh : (quyTrinh.ma || quyTrinh.maLienKet);
        let tenCheck = type === 'PHAC_DO' ? quyTrinh.tenBenh : quyTrinh.ten;

        const qtIndex = findItemIndex(targetArray, maCheck, tenCheck, type);
        
        if (qtIndex !== -1) {
            return res.status(400).json({ message: "Dữ liệu này đã có trong danh mục của Khoa!" });
        }

        quyTrinh.trangThai = "CHUA_NOP";
        targetArray.push(quyTrinh); 
        
        if (type === 'PHAC_DO') { dept.danhMucPhacDo = targetArray; dept.changed('danhMucPhacDo', true); }
        else { dept.danhMucQTKT = targetArray; dept.changed('danhMucQTKT', true); }
        
        await dept.save();
        res.json({ message: "Đã thêm vào danh sách khoa thành công!" });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống" }); }
});

app.post('/api/dept-data/remove', async (req, res) => {
    try {
        const { tenKhoa, maQuyTrinh, tenQuyTrinh, type } = req.body;
        const dept = await DeptDataModel.findOne({ where: { tenKhoa: tenKhoa } });
        if (!dept) return res.status(404).json({ message: "Không tìm thấy dữ liệu khoa" });
        
        let targetArray = type === 'PHAC_DO' ? [...dept.danhMucPhacDo] : [...dept.danhMucQTKT];
        const qtIndex = findItemIndex(targetArray, maQuyTrinh, tenQuyTrinh, type);

        if (qtIndex !== -1) {
            const qt = targetArray[qtIndex];
            await deleteFromDrive(qt.fileKhoa); await deleteFromDrive(qt.fileAdmin); await deleteFromDrive(qt.fileQuyetDinh); await deleteFromDrive(qt.fileBienBan); await deleteFromDrive(qt.filePdfChinhThuc);
            targetArray.splice(qtIndex, 1); 
            
            if (type === 'PHAC_DO') { dept.danhMucPhacDo = targetArray; dept.changed('danhMucPhacDo', true); }
            else { dept.danhMucQTKT = targetArray; dept.changed('danhMucQTKT', true); }
            
            await dept.save();
            res.json({ message: "Đã xóa dữ liệu khỏi hệ thống!" });
        } else {
            res.status(404).json({ message: "Không tìm thấy dữ liệu để xóa." });
        }
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống" }); }
});

app.post('/api/dept-data/status', async (req, res) => {
    try {
        const { tenKhoa, maQuyTrinh, tenQuyTrinh, action, type } = req.body;
        const dept = await DeptDataModel.findOne({ where: { tenKhoa } });
        if (!dept) return res.status(404).json({ message: "Không tìm thấy dữ liệu khoa" });
        
        let targetArray = type === 'PHAC_DO' ? [...dept.danhMucPhacDo] : [...dept.danhMucQTKT];
        let qtIndex = findItemIndex(targetArray, maQuyTrinh, tenQuyTrinh, type);

        if (qtIndex === -1) return res.status(404).json({ message: "Lỗi trạng thái: Không tìm thấy dữ liệu!" });

        const qt = targetArray[qtIndex];
        if (action === 'REJECT_KHOA') qt.trangThai = 'KHONG_DUYET';
        else if (action === 'RESUBMIT') qt.trangThai = 'CHUA_NOP'; 
        else if (action === 'REVERT_FINAL') { qt.trangThai = 'CHO_DUYET'; qt.filePdfChinhThuc = null; }

        if (type === 'PHAC_DO') { dept.danhMucPhacDo = targetArray; dept.changed('danhMucPhacDo', true); }
        else { dept.danhMucQTKT = targetArray; dept.changed('danhMucQTKT', true); }
        
        await dept.save();
        res.json({ message: "Đã cập nhật trạng thái thành công!" });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống" }); }
});

function extractDriveId(link) {
    if (!link) return null;
    const match = link.match(/\/d\/(.+?)\//);
    return match ? match[1] : null;
}

async function deleteFromDrive(link) {
    const fileId = extractDriveId(link);
    if (fileId && driveService) {
        try { await driveService.files.delete({ fileId: fileId }); } catch (e) {}
    }
}

async function uploadToDrive(fileObj, prefixName) {
    if (!fileObj) return null;
    const fileMetadata = { name: `${prefixName}_${fileObj.originalname}`, parents: [DRIVE_FOLDER_ID] };
    const media = { mimeType: fileObj.mimetype, body: fs.createReadStream(fileObj.path) };
    const driveRes = await driveService.files.create({ resource: fileMetadata, media: media, fields: 'id, webViewLink' });
    await driveService.permissions.create({ fileId: driveRes.data.id, requestBody: { role: 'reader', type: 'anyone' } });
    fs.unlinkSync(fileObj.path); return driveRes.data.webViewLink;
}

app.post('/api/upload/khoa', upload.single('fileQuyTrinh'), async (req, res) => {
    try {
        const { tenKhoa, maQuyTrinh, tenQuyTrinh, type } = req.body;
        if (!req.file) return res.status(400).json({ message: "Chưa chọn file!" });
        
        const dept = await DeptDataModel.findOne({ where: { tenKhoa } });
        if(!dept) return res.status(404).json({ message: "Không tìm thấy khoa!" });

        let targetArray = type === 'PHAC_DO' ? [...dept.danhMucPhacDo] : [...dept.danhMucQTKT];
        let qtIndex = findItemIndex(targetArray, maQuyTrinh, tenQuyTrinh, type);

        if (qtIndex === -1) return res.status(404).json({ message: "Chưa Thêm kỹ thuật/mã bệnh này vào giỏ hàng!" });

        let prefix = type === 'PHAC_DO' ? '[PHAC_DO]' : '[NHÁP]';
        const link = await uploadToDrive(req.file, `${prefix}_${tenKhoa}_${maQuyTrinh || tenQuyTrinh}`);
        
        targetArray[qtIndex].trangThai = 'CHO_DUYET'; 
        targetArray[qtIndex].fileKhoa = link;
        
        if (type === 'PHAC_DO') { dept.danhMucPhacDo = targetArray; dept.changed('danhMucPhacDo', true); }
        else { dept.danhMucQTKT = targetArray; dept.changed('danhMucQTKT', true); }
        
        await dept.save();
        res.json({ message: "Nộp file thành công! Đang chờ P.KHTH duyệt." });
    } catch (error) { res.status(500).json({ message: "Lỗi upload Drive" }); }
});

app.post('/api/upload/delete-khoa', async (req, res) => {
    try {
        const { tenKhoa, maQuyTrinh, tenQuyTrinh, type } = req.body;
        const dept = await DeptDataModel.findOne({ where: { tenKhoa } });
        if (!dept) return res.status(404).json({ message: "Không tìm thấy khoa!" });

        let targetArray = type === 'PHAC_DO' ? [...dept.danhMucPhacDo] : [...dept.danhMucQTKT];
        let qtIndex = findItemIndex(targetArray, maQuyTrinh, tenQuyTrinh, type);

        if (qtIndex === -1) return res.status(404).json({ message: "Không tìm thấy dữ liệu!" });

        const qt = targetArray[qtIndex];
        if (qt.fileKhoa) await deleteFromDrive(qt.fileKhoa); 

        qt.fileKhoa = null; qt.tenFileKhoa = null; qt.trangThai = 'CHUA_NOP';
        
        if (type === 'PHAC_DO') { dept.danhMucPhacDo = targetArray; dept.changed('danhMucPhacDo', true); }
        else { dept.danhMucQTKT = targetArray; dept.changed('danhMucQTKT', true); }
        
        await dept.save();
        res.json({ message: "Đã xóa file vĩnh viễn thành công!" });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống khi xóa file" }); }
});

app.post('/api/upload/final-pdf', upload.single('fPdf'), async (req, res) => {
    try {
        const { tenKhoa, maQuyTrinh, tenQuyTrinh, type } = req.body;
        if (!req.file) return res.status(400).json({ message: "Chưa chọn file PDF!" });
        
        const dept = await DeptDataModel.findOne({ where: { tenKhoa } });
        let targetArray = type === 'PHAC_DO' ? [...dept.danhMucPhacDo] : [...dept.danhMucQTKT];
        let qtIndex = findItemIndex(targetArray, maQuyTrinh, tenQuyTrinh, type);

        if (qtIndex === -1) return res.status(404).json({ message: "Không tìm thấy dữ liệu!" });

        let prefix = type === 'PHAC_DO' ? '[FINAL_PHACDO]' : '[FINAL_QTKT]';
        const linkPDF = await uploadToDrive(req.file, `${prefix}_${maQuyTrinh || tenQuyTrinh}`);
        
        targetArray[qtIndex].trangThai = 'DA_PHE_DUYET';
        targetArray[qtIndex].filePdfChinhThuc = linkPDF;
        
        if (type === 'PHAC_DO') { dept.danhMucPhacDo = targetArray; dept.changed('danhMucPhacDo', true); }
        else { dept.danhMucQTKT = targetArray; dept.changed('danhMucQTKT', true); }
        
        await dept.save();
        res.json({ message: "Đã tải file PDF chính thức thành công! Hoàn tất." });
    } catch (error) { res.status(500).json({ message: "Lỗi upload Drive" }); }
});

app.post('/api/upload/batch-qdbb', upload.fields([{ name: 'fQuyetDinh', maxCount: 1 }, { name: 'fBienBan', maxCount: 1 }]), async (req, res) => {
    try {
        const items = JSON.parse(req.body.items); const files = req.files || {};
        let linkQD = files['fQuyetDinh'] ? await uploadToDrive(files['fQuyetDinh'][0], `[QĐ]_${Date.now()}`) : null;
        let linkBB = files['fBienBan'] ? await uploadToDrive(files['fBienBan'][0], `[BB]_${Date.now()}`) : null;

        if (!linkQD && !linkBB) return res.status(400).json({ message: "Chưa chọn file nào!" });

        const deptsToSave = {};
        for (let item of items) {
            if (!deptsToSave[item.tenKhoa]) deptsToSave[item.tenKhoa] = await DeptDataModel.findOne({ where: { tenKhoa: item.tenKhoa } });
            const dept = deptsToSave[item.tenKhoa];
            if (dept) {
                let targetArray = [...dept.danhMucQTKT];
                const qtIndex = targetArray.findIndex(qt => (String(qt.ma) === String(item.maQuyTrinh) || String(qt.maLienKet) === String(item.maQuyTrinh)));
                if (qtIndex !== -1) {
                    if (linkQD) targetArray[qtIndex].fileQuyetDinh = linkQD;
                    if (linkBB) targetArray[qtIndex].fileBienBan = linkBB;
                    dept.danhMucQTKT = targetArray;
                    dept.changed('danhMucQTKT', true);
                }
            }
        }
        for (let k in deptsToSave) await deptsToSave[k].save();
        res.json({ message: "Đã đính kèm Quyết định & Biên bản thành công!" });
    } catch (error) { res.status(500).json({ message: "Lỗi upload Drive" }); }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await UserModel.findOne({ where: { username, password } });
        if (!user) return res.status(401).json({ message: "Sai tên đăng nhập hoặc mật khẩu!" });
        const token = jwt.sign({ id: user.id, role: user.role, tenKhoa: user.tenKhoa, username: user.username }, JWT_SECRET, { expiresIn: '8h' });
        res.json({ message: "Đăng nhập thành công", token, role: user.role, tenKhoa: user.tenKhoa, username: user.username });
    } catch (error) { res.status(500).json({ message: "Lỗi Server" }); }
});

app.get('/api/users', async (req, res) => {
    try { 
        const { Op } = require('sequelize');
        const users = await UserModel.findAll({ 
            where: { role: { [Op.ne]: 'admin' } },
            attributes: ['id', 'username', 'password', 'tenKhoa', 'role']
        }); 
        res.json(users); 
    } 
    catch (error) { res.status(500).json({ message: "Lỗi lấy danh sách" }); }
});

app.post('/api/users', async (req, res) => {
    try {
        const { username, password, tenKhoa, role } = req.body;
        const exists = await UserModel.findOne({ where: { username } });
        if(exists) return res.status(400).json({ message: "Tên đăng nhập đã tồn tại!" });
        await UserModel.create({ username, password, role: role, tenKhoa });
        res.json({ message: "Tạo tài khoản thành công!" });
    } catch (error) { res.status(500).json({ message: "Lỗi tạo tài khoản" }); }
});

app.put('/api/users/password', async (req, res) => {
    try {
        const { username, oldPassword, newPassword } = req.body;
        const user = await UserModel.findOne({ where: { username: username, password: oldPassword } });
        if (!user) return res.status(400).json({ message: "Mật khẩu cũ không chính xác!" });
        user.password = newPassword; await user.save();
        res.json({ message: "Cập nhật mật khẩu thành công!" });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống!" }); }
});

app.put('/api/users/admin-update', async (req, res) => {
    try {
        const { Op } = require('sequelize');
        const { id, newUsername, newPassword } = req.body;
        const exists = await UserModel.findOne({ where: { username: newUsername, id: { [Op.ne]: id } } });
        if (exists) return res.status(400).json({ message: "Tên đăng nhập này đã có người sử dụng!" });
        await UserModel.update({ username: newUsername, password: newPassword }, { where: { id: id } });
        res.json({ message: "Đã cập nhật tài khoản thành công!" });
    } catch (error) { res.status(500).json({ message: "Lỗi hệ thống" }); }
});

app.delete('/api/users/:id', async (req, res) => {
    try { await UserModel.destroy({ where: { id: req.params.id } }); res.json({ message: "Đã xóa tài khoản thành công!" }); } 
    catch (error) { res.status(500).json({ message: "Lỗi hệ thống" }); }
});

app.get('/api/icd10', (req, res) => {
    try {
        const icdPath = path.join(__dirname, 'icd10.json');
        if (fs.existsSync(icdPath)) { res.json(JSON.parse(fs.readFileSync(icdPath, 'utf8'))); } 
        else { res.json([]); }
    } catch (e) { res.status(500).json({message: "Lỗi hệ thống khi tải danh mục ICD"}); }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(PORT, () => console.log(`📡 Server chạy tại cổng: ${PORT}`));