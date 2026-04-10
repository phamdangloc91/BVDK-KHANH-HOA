window.moChiTietDV = function(encodedMaDichVu, encodedMaTuongDuong, encodedTenDichVu) {
    let maDichVu = decodeURIComponent(encodedMaDichVu || "");
    let maTuongDuong = decodeURIComponent(encodedMaTuongDuong || "");
    let tenDichVu = decodeURIComponent(encodedTenDichVu || "");

    document.getElementById('dvTenDV').innerText = tenDichVu || ''; 
    document.getElementById('dvMaDV').innerText = maDichVu || '';
    
    let qtktInfo = null;
    
    if (window.isValidForCrossLink(maTuongDuong)) {
        let qtMa = window.normalizeCodeFast(maTuongDuong);
        if(Array.isArray(database.PL1)) { let found = database.PL1.find(function(x){ return x && (window.isCodeMatch(x.ma, qtMa) || window.isCodeMatch(x.maLienKet, qtMa)); }); if(found) qtktInfo = found; }
        if(!qtktInfo && Array.isArray(database.PL2)) { let found = database.PL2.find(function(x){ return x && (window.isCodeMatch(x.ma, qtMa) || window.isCodeMatch(x.maLienKet, qtMa)); }); if(found) qtktInfo = found; }
                       
        if (!qtktInfo && Array.isArray(database.depts)) { 
            for (let d of database.depts) { 
                if(!d || !Array.isArray(d.danhMucQTKT)) continue;
                let found = d.danhMucQTKT.find(function(x){ return x && (window.isCodeMatch(x.ma, qtMa) || window.isCodeMatch(x.maLienKet, qtMa)); }); 
                if (found) { qtktInfo = found; break; } 
            } 
        }
    }

    let qtHtml = '';
    if (qtktInfo) {
        qtHtml = `<table class="user-table" style="width:100%;">
            <tr><td style="background:#f2f2f2; width:30%;"><b>Mã kỹ thuật:</b></td><td>${qtktInfo.ma || qtktInfo.maLienKet || ''}</td></tr>
            <tr><td style="background:#f2f2f2;"><b>Tên QTKT:</b></td><td>${qtktInfo.ten || ''}</td></tr>
            <tr><td style="background:#f2f2f2;"><b>Phân loại:</b></td><td><span class="badge badge-type">${qtktInfo.phanLoai || 'KPL'}</span></td></tr>
            <tr><td style="background:#f2f2f2;"><b>Quyết định:</b></td><td>${qtktInfo.quyetDinh || 'Chưa phê duyệt'}</td></tr>
        </table>`;
    } else { 
        qtHtml = `<span style="color:#856404;">Không tìm thấy Quy trình Kỹ thuật gốc cho mã tương đương này (${maTuongDuong}).</span>`; 
    }
    document.getElementById('dvQTKTArea').innerHTML = qtHtml;

    let giaDVInfo = null;
    if(Array.isArray(database.GiaDV)){ 
        giaDVInfo = database.GiaDV.find(function(x){ return x && window.isStrictCodeMatch(x.maTuongDuong, maTuongDuong); }); 
    }
    
    let bhytHtml = '';
    if (giaDVInfo) {
        let formattedPrice = giaDVInfo.giaMax ? Number(giaDVInfo.giaMax).toLocaleString('vi-VN') + ' đ' : 'Chưa có giá';
        bhytHtml = `<table class="user-table" style="width:100%;"><tr><td style="background:#f2f2f2; width:30%;"><b>Mã tương đương:</b></td><td>${giaDVInfo.maTuongDuong || ''}</td></tr><tr><td style="background:#f2f2f2;"><b>Tên Dịch vụ BHYT:</b></td><td>${giaDVInfo.tenDichVu || giaDVInfo.tenKyThuat || ''}</td></tr><tr><td style="background:#f2f2f2;"><b>Giá phê duyệt:</b></td><td style="color:red; font-weight:bold;">${formattedPrice}</td></tr></table>`;
    } else { 
        bhytHtml = `<span style="color:#856404;">Không tìm thấy Dịch vụ BHYT (TT23) khớp với mã tương đương này.</span>`; 
    }
    document.getElementById('dvBHYTArea').innerHTML = bhytHtml;

    const tbody = document.getElementById('dvKhoaBody'); 
    tbody.innerHTML = ''; 
    let fileHtml = ''; 
    let coBaoCao = false;
    
    if (qtktInfo && Array.isArray(database.depts)) {
        let qtMaGoc = window.normalizeCodeFast(qtktInfo.ma || qtktInfo.maLienKet);
        database.depts.forEach(function(d) {
            if(!d || !Array.isArray(d.danhMucQTKT)) return;
            const qt = d.danhMucQTKT.find(function(x) { return x && (window.isCodeMatch(x.ma, qtMaGoc) || window.isCodeMatch(x.maLienKet, qtMaGoc)); });
            if(qt) {
                coBaoCao = true;
                let ttRaw = qt.trangThai || 'CHUA_NOP'; 
                let tt = (ttRaw === 'DA_DUYET' || ttRaw === 'CHO_HDKHKT') ? 'CHO_DUYET' : ttRaw; 
                let ttStr = "Chưa nộp"; 
                let col = "gray";
                
                if(tt === 'CHO_DUYET') { ttStr = "Chờ KHTH duyệt"; col = "var(--warning)"; } 
                else if(tt === 'KHONG_DUYET') { ttStr = "Bị KHTH từ chối"; col = "var(--danger)"; } 
                else if(tt === 'DA_PHE_DUYET') { ttStr = "Đã phê duyệt"; col = "var(--success)"; }
                
                tbody.innerHTML += `<tr><td><b>${d.tenKhoa}</b></td><td style="color:${col}; font-weight:bold;">${ttStr}</td></tr>`;
                
                if(qt.fileQuyetDinh || qt.fileBienBan || qt.filePdfChinhThuc) {
                    fileHtml += `<div style="margin-bottom:15px; padding-bottom:10px; border-bottom: 1px dashed #ccc;"><b>Tài liệu của ${d.tenKhoa}:</b><br>`;
                    if(qt.fileQuyetDinh) fileHtml += `<a class="file-online-link" href="${qt.fileQuyetDinh}" target="_blank">📄 Xem Quyết định Phê duyệt</a>`;
                    if(qt.fileBienBan) fileHtml += `<a class="file-online-link" href="${qt.fileBienBan}" target="_blank">📄 Xem Biên bản HĐKHKT</a>`;
                    if(qt.filePdfChinhThuc) {
                        fileHtml += `<div style="display:flex; align-items:center; gap:10px; margin-top:5px; margin-bottom:5px;"><a class="file-online-link" href="${qt.filePdfChinhThuc}" target="_blank" style="background:#28a745; color:white; border:none; width:auto; margin:0;">📄 Quy trình PDF Chính thức</a>`;
                        let safeQtTen = qt.ten ? String(qt.ten) : "";
                        let safeQtMa = qt.ma || qt.maLienKet || qtMaGoc;
                        if (currentUser && currentUser.role === 'admin') { 
                            fileHtml += `<button class="btn" style="background:var(--warning); color:black; margin:0;" onclick="window.chuanBiUpSinglePdf('${window.encodeForJS(safeQtMa)}', '${d.tenKhoa}', '${window.encodeForJS(safeQtTen)}')">🔄 Cập nhật PDF</button>`; 
                        }
                        fileHtml += `</div>`;
                    }
                    fileHtml += `</div>`;
                }
            }
        });
    }
    if(!coBaoCao) tbody.innerHTML = `<tr><td colspan="2">Chưa có khoa nào đăng ký quy trình kỹ thuật liên kết.</td></tr>`;
    const fileArea = document.getElementById('dvFilesArea');
    if(fileHtml !== '') fileArea.innerHTML = fileHtml; 
    else fileArea.innerHTML = `<span style="color:#888;">Chưa có tài liệu phê duyệt nào.</span>`;
    
    window.moModal('detailDVModal');
}

window.moChiTiet = function(encodedMa, encodedTen, encodedPhanLoai, encodedQuyetDinh) {
    let ma = decodeURIComponent(encodedMa || "");
    let ten = decodeURIComponent(encodedTen || "");
    let phanLoai = decodeURIComponent(encodedPhanLoai || "");
    let quyetDinh = decodeURIComponent(encodedQuyetDinh || "");

    document.getElementById('dtTenQT').innerText = ten || ''; 
    
    let titleEl = document.getElementById('dtTenQT');
    let infoEl = document.getElementById('dtTopInfoArea'); 
    if (!infoEl) {
        infoEl = document.createElement('div');
        infoEl.id = 'dtTopInfoArea';
        titleEl.parentNode.insertBefore(infoEl, titleEl.nextSibling);
    }

    let arrMaTop = ma.split(/;|\/|\|/).filter(Boolean);
    if (arrMaTop.length === 0 && ma) arrMaTop = [ma];
    else if (!ma) arrMaTop = ["Chưa có mã"];
    
    let topInfoHtml = '';
    arrMaTop.forEach(m => {
        let cleanM = m.trim();

        let displayPhanLoai = phanLoai || 'KPL';
        let displayQuyetDinh = quyetDinh || 'Chưa phê duyệt';

        if (cleanM !== "Chưa có mã") {
            let normM = window.normalizeCodeFast(cleanM);
            let matchedInfo = null;

            if (Array.isArray(database.PL1)) {
                matchedInfo = database.PL1.find(x => x && (window.isCodeMatch(x.ma, normM) || window.isCodeMatch(x.maLienKet, normM)));
            }
            if (!matchedInfo && Array.isArray(database.PL2)) {
                matchedInfo = database.PL2.find(x => x && (window.isCodeMatch(x.ma, normM) || window.isCodeMatch(x.maLienKet, normM)));
            }

            if (matchedInfo) {
                if (matchedInfo.phanLoai && String(matchedInfo.phanLoai).trim() !== "") displayPhanLoai = matchedInfo.phanLoai;
                if (matchedInfo.quyetDinh && String(matchedInfo.quyetDinh).trim() !== "") displayQuyetDinh = matchedInfo.quyetDinh;
            }
        }

        topInfoHtml += `<div style="margin-bottom: 5px; padding: 6px 10px; background: #fdfdfe; border-radius: 4px; border: 1px solid #e9ecef; display: inline-block; margin-right: 5px;">
            Mã/Mã LK: <b style="color:var(--danger); font-size:15px;">${cleanM}</b> &nbsp;|&nbsp; 
            Phân loại: <b style="color:var(--primary);">${displayPhanLoai}</b> &nbsp;|&nbsp; 
            Quyết định: <b>${displayQuyetDinh}</b>
        </div>`;
    });
    infoEl.innerHTML = topInfoHtml;
    
    const tbody = document.getElementById('dtKhoaBody'); 
    tbody.innerHTML = ''; 
    let fileHtml = ''; 
    let coBaoCao = false;

    if(Array.isArray(database.depts)) {
        database.depts.forEach(function(d) {
            if(!d || !Array.isArray(d.danhMucQTKT)) return;
            const qt = d.danhMucQTKT.find(function(x) { 
                let nameMatch = false;
                if (ten && x.ten) { nameMatch = window.robustNormalize(x.ten) === window.robustNormalize(ten); }
                return x && (window.isCodeMatch(x.ma, ma) || window.isCodeMatch(x.maLienKet, ma) || nameMatch); 
            });
            if(qt) {
                coBaoCao = true; 
                let ttRaw = qt.trangThai || 'CHUA_NOP'; 
                let tt = (ttRaw === 'DA_DUYET' || ttRaw === 'CHO_HDKHKT') ? 'CHO_DUYET' : ttRaw; 
                let ttStr = "Chưa nộp"; 
                let col = "gray";
                
                if(tt === 'CHO_DUYET') { ttStr = "Chờ KHTH duyệt"; col = "var(--warning)"; } 
                else if(tt === 'KHONG_DUYET') { ttStr = "Bị KHTH từ chối"; col = "var(--danger)"; } 
                else if(tt === 'DA_PHE_DUYET') { ttStr = "Đã phê duyệt"; col = "var(--success)"; }
                
                tbody.innerHTML += `<tr><td><b>${d.tenKhoa}</b></td><td style="color:${col}; font-weight:bold;">${ttStr}</td></tr>`;

                if(qt.fileQuyetDinh || qt.fileBienBan || qt.filePdfChinhThuc) {
                    fileHtml += `<div style="margin-bottom:15px; padding-bottom:10px; border-bottom: 1px dashed #ccc;"><b>Tài liệu của ${d.tenKhoa}:</b><br>`;
                    if(qt.fileQuyetDinh) fileHtml += `<a class="file-online-link" href="${qt.fileQuyetDinh}" target="_blank">📄 Xem Quyết định Phê duyệt</a>`;
                    if(qt.fileBienBan) fileHtml += `<a class="file-online-link" href="${qt.fileBienBan}" target="_blank">📄 Xem Biên bản HĐKHKT</a>`;
                    if(qt.filePdfChinhThuc) {
                        fileHtml += `<div style="display:flex; align-items:center; gap:10px; margin-top:5px; margin-bottom:5px;"><a class="file-online-link" href="${qt.filePdfChinhThuc}" target="_blank" style="background:#28a745; color:white; border:none; width:auto; margin:0;">📄 Quy trình PDF Chính thức</a>`;
                        if (currentUser && currentUser.role === 'admin') {
                            fileHtml += `<button class="btn" style="background:var(--warning); color:black; margin:0;" onclick="window.chuanBiUpSinglePdf('${window.encodeForJS(ma)}', '${d.tenKhoa}', '${window.encodeForJS(ten)}')">🔄 Cập nhật PDF</button>`;
                        }
                        fileHtml += `</div>`;
                    }
                    fileHtml += `</div>`;
                }
            }
        });
    }
    
    if(!coBaoCao) tbody.innerHTML = `<tr><td colspan="2">Chưa có khoa nào đăng ký kỹ thuật này.</td></tr>`;
    
    const fileArea = document.getElementById('dtFilesArea'); 
    if(fileHtml !== '') fileArea.innerHTML = fileHtml; 
    else fileArea.innerHTML = `<span style="color:#888;">Kỹ thuật này chưa có tài liệu phê duyệt nào.</span>`;

    const giaArea = document.getElementById('dtGiaDVArea'); 
    const giaBVArea = document.getElementById('dtMaDVBVArea');
    let matchedPrices = [];
    
    if(Array.isArray(database.GiaDV) && ma) {
        let arrSearch = window.normalizeCodeFast(ma).split(';').filter(Boolean);
        matchedPrices = database.GiaDV.filter(function(priceItem) {
            if(!priceItem || !window.isValidForCrossLink(priceItem.maTuongDuong)) return false; 
            return arrSearch.some(m => window.isCodeMatch(priceItem.maTuongDuong, m));
        });
    }

    if (matchedPrices.length > 0) {
        let htmlGia = `<table class="user-table" style="margin-top: 5px; width: 100%; background: white;"><thead><tr><th>Mã tương đương</th><th>Tên Dịch vụ BHYT</th><th>Giá phê duyệt</th></tr></thead><tbody>`;
        matchedPrices.forEach(function(p) { 
            let formattedPrice = p.giaMax ? Number(p.giaMax).toLocaleString('vi-VN') + ' đ' : 'Chưa có giá'; 
            htmlGia += `<tr><td style="text-align:center;"><b>${p.maTuongDuong || ''}</b></td><td>${p.tenDichVu || p.tenKyThuat || ''}</td><td style="text-align:right; color:red; font-weight:bold;">${formattedPrice}</td></tr>`; 
        });
        htmlGia += `</tbody></table>`; 
        giaArea.innerHTML = htmlGia;
    } else { 
        giaArea.innerHTML = `<span style="color:#856404;">Chưa tìm thấy giá dịch vụ tương đương (TT23) cho kỹ thuật này.</span>`; 
    }

    let matchedBVPrices = [];
    if(Array.isArray(database.MaDVBV) && ma) {
        let arrSearch = window.normalizeCodeFast(ma).split(';').filter(Boolean);
        matchedBVPrices = database.MaDVBV.filter(function(priceItem) { 
            if(!priceItem || !window.isValidForCrossLink(priceItem.maTuongDuong)) return false;
            return arrSearch.some(m => window.isCodeMatch(priceItem.maTuongDuong, m));
        });
    }
    
    if (matchedBVPrices.length > 0) {
        let htmlGiaBV = `<table class="user-table" style="margin-top: 5px; width: 100%; background: white;"><thead><tr><th>Mã dịch vụ</th><th>Tên dịch vụ (BV)</th><th>Giá BHYT</th><th>Giá Viện Phí</th><th>Giá Yêu Cầu</th><th>Giá NN</th></tr></thead><tbody>`;
        matchedBVPrices.forEach(function(p) {
            let gBHYT = p.giaBHYT ? Number(p.giaBHYT).toLocaleString('vi-VN') + ' đ' : '-'; 
            let gVP = p.giaVienPhi ? Number(p.giaVienPhi).toLocaleString('vi-VN') + ' đ' : '-'; 
            let gYC = p.giaYeuCau ? Number(p.giaYeuCau).toLocaleString('vi-VN') + ' đ' : '-'; 
            let gNN = p.giaNuocNgoai ? Number(p.giaNuocNgoai).toLocaleString('vi-VN') + ' đ' : '-';
            htmlGiaBV += `<tr><td style="text-align:center;"><b>${p.maDichVu || ''}</b></td><td>${p.tenDichVu || ''}</td><td style="text-align:right; color:green; font-weight:bold;">${gBHYT}</td><td style="text-align:right; color:blue; font-weight:bold;">${gVP}</td><td style="text-align:right; color:purple; font-weight:bold;">${gYC}</td><td style="text-align:right; color:red; font-weight:bold;">${gNN}</td></tr>`;
        });
        htmlGiaBV += `</tbody></table>`; 
        giaBVArea.innerHTML = htmlGiaBV;
    } else { 
        giaBVArea.innerHTML = `<span style="color:#0c5460;">Chưa tìm thấy mã dịch vụ bệnh viện thiết lập cho kỹ thuật này.</span>`; 
    }
    
    let crossHtml = '';
    let pl1Matches = [];
    let pl2Matches = [];
    
    if (ma) {
        let arrMaToSearch = ma.split(/;|\/|\|/).map(m => window.normalizeCodeFast(m.trim())).filter(Boolean);

        if (currentTab !== 'PL1' && Array.isArray(database.PL1)) {
            pl1Matches = database.PL1.filter(function(x) { 
                if (!x) return false;
                let xMa = window.normalizeCodeFast(x.ma);
                return arrMaToSearch.some(m => window.isCodeMatch(x.ma, m) || window.isCodeMatch(x.maLienKet, m));
            });
        }
        
        if (currentTab !== 'PL2' && Array.isArray(database.PL2)) {
            pl2Matches = database.PL2.filter(function(x) { 
                if (!x) return false;
                let xMaLienKet = window.normalizeCodeFast(x.maLienKet);
                let xArr = xMaLienKet.split(';').filter(Boolean);
                return arrMaToSearch.some(m => xArr.some(xm => window.isCodeMatch(xm, m)));
            });
        }
    }

    if (pl1Matches.length > 0) {
        crossHtml += `<div style="margin-bottom: 8px;"><b>Kỹ thuật thuộc Phụ lục 1:</b><ul style="margin: 5px 0;">`;
        pl1Matches.forEach(function(p) { 
            crossHtml += `<li><span class="badge badge-success">${p.ma || p.maLienKet || '?'}</span> ${p.ten}</li>`; 
        });
        crossHtml += `</ul></div>`;
    }
    
    if (pl2Matches.length > 0) {
        crossHtml += `<div><b>Kỹ thuật thuộc Phụ lục 2:</b><ul style="margin: 5px 0;">`;
        pl2Matches.forEach(function(p) { 
            crossHtml += `<li><span class="badge badge-warning">${p.maLienKet || p.ma || '?'}</span> ${p.ten}</li>`; 
        });
        crossHtml += `</ul></div>`;
    }
    
    let crossArea = document.getElementById('dtCrossLinkContent');
    if (crossArea) {
        if (!crossHtml) {
            crossArea.innerHTML = `<span style="color:#888;">Kỹ thuật này không có thông tin liên kết chéo.</span>`;
        } else {
            crossArea.innerHTML = crossHtml;
        }
    }
    
    window.moModal('detailModal');
}

// 🟢 CẬP NHẬT: GIAO DIỆN BẢNG THÔNG TIN MÃ BỆNH ICD-10 ĐẦY ĐỦ 21 CỘT
window.moChiTietICD = function(encodedIdentifier) {
    let identifier = decodeURIComponent(encodedIdentifier || "");
    
    // Tìm kiếm theo Mã Bệnh, Mã Không Dấu hoặc Tên Bệnh
    let item = (database.ICD10 || []).find(x => 
        x && (x.maBenh === identifier || x.maBenhKhongDau === identifier || x.tenBenh === identifier || x.diseaseName === identifier)
    );
    
    if(!item) return alert("Không tìm thấy dữ liệu chi tiết cho mã bệnh này!");
    
    document.getElementById('icdMa').innerText = item.maBenh || '';
    document.getElementById('icdMaKhongDau').innerText = item.maBenhKhongDau ? `(${item.maBenhKhongDau})` : '';
    
    document.getElementById('icdTenVn').innerText = item.tenBenh || 'Chưa có thông tin Tên bệnh/Chẩn đoán';
    document.getElementById('icdTenEn').innerText = item.diseaseName || 'Không có';
    
    // Chương
    document.getElementById('icdMaChuong').innerText = item.maChuong || '';
    document.getElementById('icdTenChuong').innerText = item.tenChuong || 'Không phân loại';
    document.getElementById('icdChapterName').innerText = item.chapterName || '';
    
    // Nhóm chính
    document.getElementById('icdMaNhomChinh').innerText = item.maNhomChinh || '';
    document.getElementById('icdTenNhomChinh').innerText = item.tenNhomChinh || 'Không phân loại';
    document.getElementById('icdMainGroupNameI').innerText = item.mainGroupNameI || '';
    
    // Nhóm phụ 1 (Tự động ẩn nếu trống)
    let rowNhomPhu1 = document.getElementById('rowNhomPhu1');
    if (item.maNhomPhu1 || item.tenNhomPhu1) {
        rowNhomPhu1.style.display = 'table-row';
        document.getElementById('icdMaNhomPhu1').innerText = item.maNhomPhu1 || '';
        document.getElementById('icdTenNhomPhu1').innerText = item.tenNhomPhu1 || '';
        document.getElementById('icdSubGroupNameI').innerText = item.subGroupNameI || '';
    } else {
        rowNhomPhu1.style.display = 'none';
    }
    
    // Nhóm phụ 2 (Tự động ẩn nếu trống)
    let rowNhomPhu2 = document.getElementById('rowNhomPhu2');
    if (item.maNhomPhu2 || item.tenNhomPhu2) {
        rowNhomPhu2.style.display = 'table-row';
        document.getElementById('icdMaNhomPhu2').innerText = item.maNhomPhu2 || '';
        document.getElementById('icdTenNhomPhu2').innerText = item.tenNhomPhu2 || '';
        document.getElementById('icdSubGroupNameII').innerText = item.subGroupNameII || '';
    } else {
        rowNhomPhu2.style.display = 'none';
    }
    
    // Loại
    document.getElementById('icdMaLoai').innerText = item.maLoai || '';
    document.getElementById('icdTenLoai').innerText = item.tenLoai || '';
    document.getElementById('icdTypeName').innerText = item.typeName || '';
    
    // Ghi chú
    document.getElementById('icdGhiChu').innerText = item.ghiChu || 'Không có';
    
    // Area Phác đồ
    document.getElementById('icdPhacDoArea').innerHTML = `<p style="color:#666;">Chưa có phác đồ nào được nộp cho mã bệnh này.</p>`;
    
    window.moModal('icdModal');
}