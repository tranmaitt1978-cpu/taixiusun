
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const API_GOC = 'https://sunwin-taixiu-dulieu.onrender.com/data';

app.use(cors());
app.use(express.json());

// bộ nhớ đệm
let cacheData = null;
let cacheTime = 0;
const CACHE_TTL = 5000;

/* ================================================================
   TIỆN ÍCH
   ================================================================ */
function chuanHoa(val) {
  if (!val) return null;
  const s = String(val).trim().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (['TAI', 'T', '1', 'TRUE'].includes(s)) return 'TAI';
  if (['XIU', 'X', '0', 'FALSE'].includes(s)) return 'XIU';
  return null;
}

async function layDuLieu() {
  const now = Date.now();
  if (cacheData && (now - cacheTime) < CACHE_TTL) return cacheData;
  const r = await fetch(API_GOC, { cache: 'no-cache' });
  const j = await r.json();
  let items = Array.isArray(j) ? j : (j.data || j.list || []);
  items.sort((a, b) => (a.phien || 0) - (b.phien || 0));
  cacheData = items;
  cacheTime = now;
  return items;
}

function taoChuoi(items) {
  return items.map(x => chuanHoa(x.ket_qua)).filter(Boolean);
}

/* ================================================================
   CÁC HÀM PHÂN TÍCH CẦU
   ================================================================ */

// mã hóa run
function maHoaRun(seq) {
  const runs = [];
  if (!seq.length) return runs;
  let side = seq[0], len = 1;
  for (let i = 1; i < seq.length; i++) {
    if (seq[i] === side) len++;
    else { runs.push({ side, length: len }); side = seq[i]; len = 1; }
  }
  runs.push({ side, length: len });
  return runs;
}

// cầu 1-1
function cau11(seq, cuaSo = 20) {
  const data = seq.slice(-cuaSo);
  if (data.length < 5) return null;
  let xen = 0;
  for (let i = 1; i < data.length; i++) if (data[i] !== data[i-1]) xen++;
  const tyLe = xen / (data.length - 1);
  if (tyLe >= 0.65) {
    return {
      ten: 'cầu 1-1',
      duDoan: data[data.length - 1] === 'TAI' ? 'XIU' : 'TAI',
      doTinCay: tyLe,
      moTa: `xen kẽ ${(tyLe*100).toFixed(0)}%`
    };
  }
  return null;
}

// cầu 2-2
function cau22(seq) {
  const runs = maHoaRun(seq);
  if (runs.length < 6) return null;
  const recent = runs.slice(-6);
  const khop = recent.filter(r => r.length === 2).length;
  if (khop >= 4) {
    const last = recent[recent.length - 1];
    return {
      ten: 'cầu 2-2',
      duDoan: last.length === 2 ? (last.side === 'TAI' ? 'XIU' : 'TAI') : last.side,
      doTinCay: 0.7,
      moTa: '2-2 pattern'
    };
  }
  return null;
}

// cầu 3-3
function cau33(seq) {
  const runs = maHoaRun(seq);
  if (runs.length < 6) return null;
  const recent = runs.slice(-6);
  const khop = recent.filter(r => r.length === 3).length;
  if (khop >= 4) {
    const last = recent[recent.length - 1];
    return {
      ten: 'cầu 3-3',
      duDoan: last.length === 3 ? (last.side === 'TAI' ? 'XIU' : 'TAI') : last.side,
      doTinCay: 0.7,
      moTa: '3-3 pattern'
    };
  }
  return null;
}

// cầu 4-4
function cau44(seq) {
  const runs = maHoaRun(seq);
  if (runs.length < 6) return null;
  const recent = runs.slice(-6);
  const khop = recent.filter(r => r.length === 4).length;
  if (khop >= 3) {
    return {
      ten: 'cầu 4-4',
      duDoan: recent[recent.length - 1].side === 'TAI' ? 'XIU' : 'TAI',
      doTinCay: 0.7,
      moTa: '4-4 pattern'
    };
  }
  return null;
}

// cầu 1-2-1
function cau121(seq) {
  const runs = maHoaRun(seq);
  if (runs.length < 3) return null;
  const lens = runs.slice(-3).map(r => r.length);
  if (lens[0] === 1 && lens[1] === 2 && lens[2] === 1) {
    return { ten: 'cầu 1-2-1', duDoan: runs[runs.length-1].side === 'TAI' ? 'XIU' : 'TAI', doTinCay: 0.65, moTa: '1-2-1' };
  }
  if (lens[0] === 2 && lens[1] === 1 && lens[2] === 2) {
    return { ten: 'cầu 2-1-2', duDoan: runs[runs.length-1].side === 'TAI' ? 'XIU' : 'TAI', doTinCay: 0.65, moTa: '2-1-2' };
  }
  return null;
}

// cầu 1-2-2-1
function cau1221(seq) {
  const runs = maHoaRun(seq);
  if (runs.length < 4) return null;
  const lens = runs.slice(-4).map(r => r.length);
  if (lens[0] === 1 && lens[1] === 2 && lens[2] === 2 && lens[3] === 1) {
    return { ten: 'cầu 1-2-2-1', duDoan: runs[runs.length-1].side === 'TAI' ? 'XIU' : 'TAI', doTinCay: 0.68, moTa: '1-2-2-1' };
  }
  if (lens[0] === 2 && lens[1] === 1 && lens[2] === 1 && lens[3] === 2) {
    return { ten: 'cầu 2-1-1-2', duDoan: runs[runs.length-1].side === 'TAI' ? 'XIU' : 'TAI', doTinCay: 0.68, moTa: '2-1-1-2' };
  }
  return null;
}

// bậc thang
function bacThang(seq) {
  const runs = maHoaRun(seq);
  if (runs.length < 4) return null;
  const recent = runs.slice(-5);
  const lens = recent.map(r => r.length);
  let tang = 0, giam = 0;
  for (let i = 1; i < lens.length; i++) {
    if (lens[i] > lens[i - 1]) tang++;
    if (lens[i] < lens[i - 1]) giam++;
  }
  const last = recent[recent.length - 1];
  if (tang >= 3) return { ten: 'bậc thang tăng', duDoan: last.side === 'TAI' ? 'XIU' : 'TAI', doTinCay: 0.6, moTa: `tăng ${lens.join('-')}` };
  if (giam >= 3) return { ten: 'bậc thang giảm', duDoan: last.side, doTinCay: 0.55, moTa: `giảm ${lens.join('-')}` };
  return null;
}

// markov 1
function markov1(seq) {
  let TT = 0, TX = 0, XT = 0, XX = 0;
  for (let i = 1; i < seq.length; i++) {
    const a = seq[i-1], b = seq[i];
    if (a === 'TAI' && b === 'TAI') TT++;
    if (a === 'TAI' && b === 'XIU') TX++;
    if (a === 'XIU' && b === 'TAI') XT++;
    if (a === 'XIU' && b === 'XIU') XX++;
  }
  const last = seq[seq.length - 1];
  let p, support;
  if (last === 'TAI') { const t = TT + TX; p = t > 0 ? TT / t : 0.5; support = t; }
  else { const t = XT + XX; p = t > 0 ? XX / t : 0.5; support = t; }
  if (support < 10) return null;
  return {
    ten: 'Markov 1',
    duDoan: p > 0.5 ? 'TAI' : 'XIU',
    doTinCay: Math.abs(p - 0.5) * 2,
    moTa: `P(${last}→) support ${support}`
  };
}

// markov N
function markovN(seq, bac) {
  if (seq.length < bac + 3) return null;
  const map = {};
  for (let i = bac; i < seq.length; i++) {
    const key = seq.slice(i - bac, i).join('');
    if (!map[key]) map[key] = { TAI: 0, XIU: 0 };
    map[key][seq[i]]++;
  }
  const k = seq.slice(-bac).join('');
  if (!map[k]) return null;
  const d = map[k];
  const t = d.TAI + d.XIU;
  if (t < 3) return null;
  const pT = d.TAI / t;
  return {
    ten: `Markov ${bac}`,
    duDoan: pT > 0.5 ? 'TAI' : 'XIU',
    doTinCay: Math.max(pT, 1 - pT) * 0.9,
    moTa: `M${bac} support ${t}`
  };
}

// pattern lặp
function timPattern(seq, doDai) {
  if (seq.length < doDai + 2) return null;
  const pattern = seq.slice(-doDai).join('');
  let t = 0, x = 0;
  for (let i = doDai; i < seq.length; i++) {
    if (seq.slice(i - doDai, i).join('') === pattern) {
      if (seq[i] === 'TAI') t++; else x++;
    }
  }
  const tong = t + x;
  if (tong < 3) return null;
  const pT = t / tong;
  return {
    ten: `Pattern ${doDai}`,
    duDoan: pT > 0.5 ? 'TAI' : 'XIU',
    doTinCay: Math.max(pT, 1 - pT) * 0.9,
    moTa: `P${doDai} support ${tong}`
  };
}

// entropy
function tinhEntropy(seq) {
  if (!seq.length) return 0;
  const t = seq.filter(x => x === 'TAI').length / seq.length;
  const x = 1 - t;
  let h = 0;
  if (t > 0) h -= t * Math.log2(t);
  if (x > 0) h -= x * Math.log2(x);
  return h;
}

function duDoanEntropy(seq) {
  const data = seq.slice(-50);
  const h = tinhEntropy(data);
  if (h < 0.7) {
    const t = data.filter(x => x === 'TAI').length;
    return { ten: 'Entropy thấp', duDoan: t > 25 ? 'TAI' : 'XIU', doTinCay: 0.65, moTa: `H=${h.toFixed(3)}` };
  }
  if (h > 0.98) {
    return { ten: 'Entropy cao', duDoan: seq[seq.length - 1] === 'TAI' ? 'XIU' : 'TAI', doTinCay: 0.5, moTa: `H=${h.toFixed(3)}` };
  }
  return null;
}

// tần suất
function tanSuat(seq, cuaSo) {
  if (seq.length < cuaSo) return null;
  const data = seq.slice(-cuaSo);
  const t = data.filter(x => x === 'TAI').length;
  const x = data.length - t;
  const lech = Math.abs(t - x) / data.length;
  if (lech > 0.35) {
    return {
      ten: `Tần suất ${cuaSo}`,
      duDoan: t > x ? 'XIU' : 'TAI',
      doTinCay: 0.5 + lech * 0.3,
      moTa: `T${t}/X${x}`
    };
  }
  return null;
}

// đảo chiều
function daoChieu(seq) {
  const runs = maHoaRun(seq);
  if (!runs.length) return null;
  const last = runs[runs.length - 1];
  if (last.length >= 5) return { ten: 'Đảo chiều', duDoan: last.side === 'TAI' ? 'XIU' : 'TAI', doTinCay: 0.8, moTa: `chuỗi ${last.length}` };
  if (last.length >= 4) return { ten: 'Đảo chiều', duDoan: last.side === 'TAI' ? 'XIU' : 'TAI', doTinCay: 0.65, moTa: `chuỗi ${last.length}` };
  return null;
}

// sóng ngắn
function songNgan(seq) {
  if (seq.length < 5) return null;
  const d = seq.slice(-5);
  const t = d.filter(x => x === 'TAI').length;
  if (t >= 4) return { ten: 'Sóng ngắn', duDoan: 'XIU', doTinCay: 0.6, moTa: `5p ${t}T` };
  if (t <= 1) return { ten: 'Sóng ngắn', duDoan: 'TAI', doTinCay: 0.6, moTa: `5p ${t}T` };
  return null;
}

// momentum
function momentum(seq) {
  if (seq.length < 10) return null;
  const s10 = seq.slice(-10), s5 = seq.slice(-5);
  const t10 = s10.filter(x => x === 'TAI').length / 10;
  const t5 = s5.filter(x => x === 'TAI').length / 5;
  if (t5 > t10 + 0.2) return { ten: 'Momentum T', duDoan: 'TAI', doTinCay: 0.55, moTa: 'tăng' };
  if (t5 < t10 - 0.2) return { ten: 'Momentum X', duDoan: 'XIU', doTinCay: 0.55, moTa: 'giảm' };
  return null;
}

// chu kỳ
function chuKy(seq) {
  if (seq.length < 20) return null;
  let best = null;
  for (let p = 2; p <= 12; p++) {
    let same = 0, tot = 0;
    for (let i = p; i < seq.length; i++) {
      tot++;
      if (seq[i] === seq[i - p]) same++;
    }
    const r = same / tot;
    if (!best || r > best.r) best = { p, r };
  }
  if (best && best.r >= 0.65) {
    const pred = seq[seq.length - best.p] || seq[seq.length - 1];
    return { ten: 'Chu kỳ', duDoan: pred, doTinCay: (best.r - 0.5) * 1.5, moTa: `CK${best.p}` };
  }
  return null;
}

// cầu 3-2-1
function cau321(seq) {
  const runs = maHoaRun(seq);
  if (runs.length < 3) return null;
  const lens = runs.slice(-3).map(r => r.length);
  if (lens[0] === 3 && lens[1] === 2 && lens[2] === 1) {
    return { ten: 'Cầu 3-2-1', duDoan: runs[runs.length-1].side === 'TAI' ? 'XIU' : 'TAI', doTinCay: 0.65, moTa: '3-2-1' };
  }
  if (lens[0] === 1 && lens[1] === 2 && lens[2] === 3) {
    return { ten: 'Cầu 1-2-3', duDoan: runs[runs.length-1].side, doTinCay: 0.6, moTa: '1-2-3' };
  }
  return null;
}

// cầu 2-1-1
function cau211(seq) {
  const runs = maHoaRun(seq);
  if (runs.length < 3) return null;
  const lens = runs.slice(-3).map(r => r.length);
  if (lens[0] === 2 && lens[1] === 1 && lens[2] === 1) {
    return { ten: 'Cầu 2-1-1', duDoan: runs[runs.length-1].side, doTinCay: 0.6, moTa: '2-1-1' };
  }
  if (lens[0] === 1 && lens[1] === 1 && lens[2] === 2) {
    return { ten: 'Cầu 1-1-2', duDoan: runs[runs.length-1].side === 'TAI' ? 'XIU' : 'TAI', doTinCay: 0.6, moTa: '1-1-2' };
  }
  return null;
}

/* ================================================================
   TỔNG HỢP
   ================================================================ */
function phanTichTongHop(seq) {
  const signals = [];
  const add = (s) => { if (s && s.duDoan) signals.push(s); };

  add(cau11(seq));
  add(cau22(seq));
  add(cau33(seq));
  add(cau44(seq));
  add(cau121(seq));
  add(cau1221(seq));
  add(bacThang(seq));
  add(markov1(seq));
  [2, 3, 4].forEach(b => add(markovN(seq, b)));
  [4, 5, 6, 7].forEach(l => add(timPattern(seq, l)));
  add(duDoanEntropy(seq));
  [10, 20, 30, 50].forEach(cs => add(tanSuat(seq, cs)));
  add(daoChieu(seq));
  add(songNgan(seq));
  add(momentum(seq));
  add(chuKy(seq));
  add(cau321(seq));
  add(cau211(seq));

  if (!signals.length) {
    return { duDoan: null, doTinCay: 0, signals: [], lyDo: 'không có tín hiệu' };
  }

  let diemTai = 0, diemXiu = 0, tongW = 0;
  signals.forEach(s => {
    const w = s.doTinCay;
    if (s.duDoan === 'TAI') diemTai += w;
    else diemXiu += w;
    tongW += w;
  });

  const duDoan = diemTai > diemXiu ? 'TAI' : 'XIU';
  const doTinCay = Math.max(diemTai, diemXiu) / tongW;
  const soTai = signals.filter(s => s.duDoan === 'TAI').length;
  const soXiu = signals.filter(s => s.duDoan === 'XIU').length;
  const dongThuan = Math.max(soTai, soXiu) / signals.length;

  return {
    duDoan,
    doTinCay: parseFloat(doTinCay.toFixed(4)),
    dongThuan: parseFloat(dongThuan.toFixed(4)),
    soTinHieu: signals.length,
    soTai,
    soXiu,
    diemTai: parseFloat(diemTai.toFixed(4)),
    diemXiu: parseFloat(diemXiu.toFixed(4)),
    signals: signals.sort((a, b) => b.doTinCay - a.doTinCay),
    lyDo: signals.slice(0, 5).map(s => `${s.ten}:${s.duDoan}(${(s.doTinCay*100).toFixed(0)}%)`).join(' | ')
  };
}

/* ================================================================
   ROUTES
   ================================================================ */

// dữ liệu gốc đã chuẩn hóa
app.get('/data', async (req, res) => {
  try {
    const items = await layDuLieu();
    res.json({
      name: 'API Thuật Toán Cầu By nghuyhoang',
      total: items.length,
      data: items
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// dự đoán phiên tiếp theo
app.get('/predict', async (req, res) => {
  try {
    const items = await layDuLieu();
    const seq = taoChuoi(items);
    const phienHienTai = items[items.length - 1].phien;
    const kq = phanTichTongHop(seq);

    res.json({
      name: 'Du Doan Cau Tai Xiu By nghuyhoang',
      phien_hien_tai: phienHienTai,
      phien_du_doan: phienHienTai + 1,
      du_doan: kq.duDoan,
      do_tin_cay: kq.doTinCay,
      dong_thuan: kq.dongThuan,
      so_tin_hieu: kq.soTinHieu,
      so_tai: kq.soTai,
      so_xiu: kq.soXiu,
      diem_tai: kq.diemTai,
      diem_xiu: kq.diemXiu,
      ly_do: kq.lyDo,
      signals: kq.signals,
      thoi_gian: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// thống kê chi tiết
app.get('/stats', async (req, res) => {
  try {
    const items = await layDuLieu();
    const seq = taoChuoi(items);
    const runs = maHoaRun(seq);
    const tai = seq.filter(x => x === 'TAI').length;
    const xiu = seq.length - tai;
    const chuoiDaiNhat = Math.max(...runs.map(r => r.length));

    // thống kê tổng điểm
    const demTong = {};
    items.forEach(x => {
      const t = x.tong;
      if (t) demTong[t] = (demTong[t] || 0) + 1;
    });

    // phân bố độ dài run
    const phanBoRun = {};
    runs.forEach(r => { phanBoRun[r.length] = (phanBoRun[r.length] || 0) + 1; });

    res.json({
      name: 'Thong Ke Cau By nghuyhoang',
      tong_phien: seq.length,
      tai,
      xiu,
      ty_le_tai: parseFloat((tai / seq.length).toFixed(4)),
      ty_le_xiu: parseFloat((xiu / seq.length).toFixed(4)),
      tong_run: runs.length,
      chuoi_dai_nhat: chuoiDaiNhat,
      chuoi_hien_tai: runs[runs.length - 1],
      phan_bo_run: phanBoRun,
      thong_ke_tong_diem: demTong,
      entropy: parseFloat(tinhEntropy(seq).toFixed(4))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// dự đoán nhiều phiên (mô phỏng)
app.get('/predict/multi', async (req, res) => {
  try {
    const n = parseInt(req.query.n) || 5;
    const items = await layDuLieu();
    let seq = taoChuoi(items);
    const phienGoc = items[items.length - 1].phien;
    const ketQua = [];

    for (let i = 0; i < n; i++) {
      const kq = phanTichTongHop(seq);
      ketQua.push({
        phien: phienGoc + i + 1,
        du_doan: kq.duDoan,
        do_tin_cay: kq.doTinCay,
        dong_thuan: kq.dongThuan
      });
      if (kq.duDoan) seq.push(kq.duDoan);
    }

    res.json({
      name: 'Du Doan Nhieu Phien By nghuyhoang',
      so_phien: n,
      ket_qua: ketQua
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// khởi động
app.listen(PORT, () => {
  console.log(`[CAU API] server chạy tại http://localhost:${PORT}`);
  console.log(`[CAU API] /data - dữ liệu gốc`);
  console.log(`[CAU API] /predict - dự đoán phiên tiếp`);
  console.log(`[CAU API] /stats - thống kê chi tiết`);
  console.log(`[CAU API] /predict/multi?n=5 - dự đoán nhiều phiên`);
});

module.exports = app;