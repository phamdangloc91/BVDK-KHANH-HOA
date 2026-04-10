window.xuLyDangNhap = async function() {
    const u = document.getElementById('username').value; const p = document.getElementById('password').value; const errTag = document.getElementById('loginError');
    if (!u || !p) { errTag.innerText = "Vui lòng nhập đủ thông tin!"; errTag.style.display = 'block'; return; }
    try {
        const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
        const data = await response.json();
        if (response.ok) {
            currentUser = { token: data.token, role: data.role, tenKhoa: data.tenKhoa, username: data.username }; localStorage.setItem('hospital_user', JSON.stringify(currentUser));
            window.dongModal('loginModal'); document.getElementById('username').value = ''; document.getElementById('password').value = ''; errTag.style.display = 'none'; window.capNhatGiaoDienSauDangNhap(); window.layDuLieu();
        } else { errTag.innerText = data.message; errTag.style.display = 'block'; }
    } catch (error) { errTag.innerText = "Lỗi kết nối máy chủ!"; errTag.style.display = 'block'; }
}

window.capNhatGiaoDienSauDangNhap = function() {
    if(!currentUser) return;
    let navHtml = `👤 <b>${currentUser.tenKhoa}</b>`; const menuKHTH = document.getElementById('menuKHTH');
    if (currentUser.role === 'admin') {
        document.getElementById('userActionBar').style.display = 'flex'; document.getElementById('btnNhapExcel').style.display = 'inline-block'; 
        if(menuKHTH) menuKHTH.style.display = 'inline-block'; navHtml += ` | <a href="#" onclick="window.moQuanLyTaiKhoan()" style="color:#fff; text-decoration:none;">Quản lý TK</a>`;
    } else {
        document.getElementById('userActionBar').style.display = 'flex'; document.getElementById('btnNhapExcel').style.display = 'none'; 
        if(menuKHTH) menuKHTH.style.display = 'none'; 
    }
    navHtml += ` | <a href="#" onclick="window.moModal('pwdModal')" style="color:#fff; text-decoration:none;">Đổi MK</a> | <a href="#" onclick="window.dangXuat()" style="color:#ffcccc; text-decoration:none;">[Đăng xuất]</a>`;
    document.getElementById('navAuthArea').innerHTML = navHtml; window.capNhatTieuDe(); 
}

window.dangXuat = function() { localStorage.removeItem('hospital_user'); location.reload(); }

window.xuLyDoiMatKhau = async function() {
    const oldPwd = document.getElementById('oldPwd').value; const newPwd = document.getElementById('newPwd').value; const confirmPwd = document.getElementById('confirmPwd').value;
    if (!oldPwd || !newPwd || !confirmPwd) return alert("Vui lòng nhập đủ thông tin!"); if (newPwd !== confirmPwd) return alert("Mật khẩu xác nhận không khớp!");
    window.showLoading(true);
    try {
        const res = await fetch('/api/users/password', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: currentUser.username, oldPassword: oldPwd, newPassword: newPwd }) });
        const data = await res.json(); alert(data.message);
        if (res.ok) { window.dongModal('pwdModal'); document.getElementById('oldPwd').value = ''; document.getElementById('newPwd').value = ''; document.getElementById('confirmPwd').value = ''; }
    } catch(e) { alert("Lỗi mạng!"); } window.showLoading(false);
}

window.moQuanLyTaiKhoan = async function() { window.moModal('adminModal'); await window.loadDanhSachTaiKhoan(); }

window.loadDanhSachTaiKhoan = async function() {
    try {
        const res = await fetch('/api/users'); const users = await res.json(); const tbody = document.getElementById('userListBody'); tbody.innerHTML = '';
        users.forEach(function(u, i) { 
            tbody.innerHTML += `<tr><td>${i+1}</td><td>[Khoa] <b>${u.tenKhoa}</b></td><td><input type="text" id="edit-user-${u._id}" class="inline-input" value="${u.username}"></td><td><input type="text" id="edit-pass-${u._id}" class="inline-input" value="${u.password}" style="color:red; font-weight:bold;"></td><td><button class="btn" style="background:#ffc107; color:black; padding:6px; font-size:12px;" onclick="window.suaTaiKhoan('${u._id}')">💾 Lưu</button> <button class="btn" style="background:#dc3545; padding:6px; font-size:12px;" onclick="window.xoaTaiKhoan('${u._id}', '${u.tenKhoa}')">🗑️ Xóa</button></td></tr>`; 
        });
    } catch(e) { console.log(e); }
}

window.taoTaiKhoan = async function() {
    const u = document.getElementById('newUsername').value; const p = document.getElementById('newPassword').value; const k = document.getElementById('newTenKhoa').value;
    if (!u || !p || !k) return alert("Vui lòng nhập đủ thông tin!");
    let role = k === 'ROLE_ADMIN' ? 'admin' : 'khoa'; let tenKhoa = k === 'ROLE_ADMIN' ? 'Phòng Kế hoạch tổng hợp' : k;
    window.showLoading(true);
    try {
        const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p, role: role, tenKhoa: tenKhoa }) });
        const data = await res.json(); alert(data.message);
        if (res.ok) { document.getElementById('newUsername').value = ''; document.getElementById('newPassword').value = ''; document.getElementById('newTenKhoa').value = ''; await window.loadDanhSachTaiKhoan(); }
    } catch(e) { alert("Lỗi mạng!"); } window.showLoading(false);
}

window.suaTaiKhoan = async function(id) {
    const u = document.getElementById(`edit-user-${id}`).value; const p = document.getElementById(`edit-pass-${id}`).value;
    if (!u || !p) return alert("Không được để trống tên đăng nhập và mật khẩu!");
    window.showLoading(true);
    try {
        const res = await fetch('/api/users/admin-update', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id, newUsername: u, newPassword: p }) });
        const data = await res.json(); alert(data.message);
    } catch(e) { alert("Lỗi mạng!"); } window.showLoading(false);
}

window.xoaTaiKhoan = async function(id, tenKhoa) {
    if (!confirm(`Xác nhận xóa tài khoản của ${tenKhoa}?`)) return; window.showLoading(true);
    try {
        const res = await fetch(`/api/users/${id}`, { method: 'DELETE' }); const data = await res.json(); alert(data.message);
        if (res.ok) await window.loadDanhSachTaiKhoan();
    } catch(e) { alert("Lỗi mạng!"); } window.showLoading(false);
}