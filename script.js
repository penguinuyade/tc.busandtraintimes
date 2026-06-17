// --- 設定パラメータ ---
const SETTINGS = {
    busType: 'city',
    trainLine: 'jr',
    trainDir: 'osaka' // デフォルトは大阪方面
};

const SHUTTLE_SCHEDULE = ['14:40', '16:20', '18:00'];

// データの格納先
let cityBusData = [];
let trainDataJROsaka = [];
let trainDataJRKyoto = [];
let trainDataHankyuKawaramachi = [];
let trainDataHankyuUmeda = [];

// 乗車予定のバス情報
let boardedBus = null;
let currentDisplayedBuses = []; 

// --- アプリケーション初期化 ---
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    await fetchAllData();
    updateDisplay();
    setInterval(updateDisplay, 60000); // 1分ごとに更新
});

// --- CSVデータの取得と解析 ---
async function fetchAllData() {
    try {
        const [busRes, jrOsakaRes, jrKyotoRes, hkKawaramachiRes, hkUmedaRes] = await Promise.all([
            fetch('Excelfile/関西大学バス時刻表_平日.csv'),
            fetch('Excelfile/高槻駅時刻表_姫路西明石方面.csv'),
            fetch('Excelfile/高槻駅時刻表 _京都米原方面.csv'),
            fetch('Excelfile/高槻市駅時刻表_阪急京都方面_平日.csv'),
            fetch('Excelfile/高槻市駅時刻表_阪急大阪方面_平日.csv') 
        ]);

        cityBusData = parseCSV(await busRes.text(), 3, 1, -1, 2); 
        trainDataJROsaka = parseCSV(await jrOsakaRes.text(), 2, 1, 2, 3); 
        trainDataJRKyoto = parseCSV(await jrKyotoRes.text(), 2, 1, 2, 3); 
        trainDataHankyuKawaramachi = parseCSV(await hkKawaramachiRes.text(), 2, 1, 2, 3);
        trainDataHankyuUmeda = parseCSV(await hkUmedaRes.text(), 2, 1, 2, 3); 
    } catch (error) {
        console.error("データの読み込みに失敗しました:", error);
        alert("データの読み込みに失敗しました。5つのCSVファイルが揃っているか確認してください。");
    }
}

function parseCSV(csvText, skipRows, timeColIndex, typeColIndex, destColIndex) {
    const lines = csvText.trim().split('\n');
    const result = [];
    
    for (let i = skipRows; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length > timeColIndex && cols[timeColIndex].includes(':')) {
            result.push({
                timeStr: cols[timeColIndex].trim(),
                mins: timeToMinutes(cols[timeColIndex].trim()),
                type: typeColIndex !== -1 ? cols[typeColIndex].trim() : '',
                dest: destColIndex !== -1 ? cols[destColIndex].trim() : ''
            });
        }
    }
    return result;
}

// --- ユーティリティ ---
function timeToMinutes(timeStr) {
    const parts = timeStr.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function minutesToTime(mins) {
    const h = Math.floor(mins / 60) % 24;
    const m = mins % 60;
    return `${h}:${m.toString().padStart(2, '0')}`;
}

function getCurrentMinutes() {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
}

function getTrainTypeClass(typeStr, line) {
    if (line === 'hankyu') {
        if (typeStr.includes('快速特急')) return 'type-hk-rapid-ltd'; 
        if (typeStr.includes('特急')) return 'type-ltd-exp'; 
        if (typeStr.includes('急行')) return 'type-hk-exp'; 
        if (typeStr.includes('快速')) return 'type-blue-rapid'; 
        if (typeStr.includes('準急')) return 'type-hk-semi'; 
        return 'type-local'; 
    } else {
        if (typeStr.includes('特急')) return 'type-ltd-exp'; 
        if (typeStr.includes('新快速')) return 'type-blue-rapid'; 
        if (typeStr.includes('快速')) return 'type-jr-rapid'; 
        return 'type-local'; 
    }
}

// --- メイン表示更新ロジック ---
function updateDisplay() {
    const currentMins = getCurrentMinutes();

    // シャトルバス予約ボタンの表示切替
    const reservationBox = document.getElementById('shuttle-reservation');
    if (SETTINGS.busType === 'shuttle') {
        reservationBox.style.display = 'block';
    } else {
        reservationBox.style.display = 'none';
    }

    // 次のバスの計算
    let nextBuses = [];
    if (SETTINGS.busType === 'city') {
        const filtered = cityBusData.filter(b => b.mins >= currentMins).slice(0, 3);
        nextBuses = filtered.map(b => ({
            timeStr: b.timeStr, mins: b.mins, dest: b.dest, offset: 30, label: '到着時刻'
        }));
    } else {
        const nextTargetTime = SHUTTLE_SCHEDULE.find(timeStr => timeToMinutes(timeStr) >= currentMins);
        if (nextTargetTime) {
            const baseMins = timeToMinutes(nextTargetTime);
            nextBuses = [
                { timeStr: nextTargetTime, mins: baseMins, dest: 'シャトル 1号車', offset: 20, label: '到着予想' },
                { timeStr: nextTargetTime, mins: baseMins, dest: 'シャトル 2号車', offset: 23, label: '到着予想' },
                { timeStr: nextTargetTime, mins: baseMins, dest: 'シャトル 3号車', offset: 25, label: '到着予想' }
            ];
        }
    }
    
    currentDisplayedBuses = nextBuses; 

    // 乗車予定のバスの描画
    const boardedBusContainer = document.getElementById('boarded-bus-container');
    const boardedBusList = document.getElementById('boarded-bus-list');
    boardedBusList.innerHTML = '';
    
    if (boardedBus) {
        boardedBusContainer.style.display = 'block';
        
        const li = document.createElement('li');
        li.className = 'list-item boarded-bus clickable-bus';
        const arrivalTimeStr = minutesToTime(boardedBus.mins + boardedBus.offset);
        
        li.innerHTML = `
            <span class="time-item">${boardedBus.timeStr}</span>
            <span class="dest-item">${boardedBus.dest}</span>
            <span class="arrival-item">${boardedBus.label}<br><strong>${arrivalTimeStr}</strong></span>
        `;
        
        li.onclick = () => {
            showConfirmModal(boardedBus, true); 
        };
        boardedBusList.appendChild(li);
    } else {
        boardedBusContainer.style.display = 'none';
    }

    // 通常のバスリストを描画
    renderBuses(nextBuses);

    // 電車の描画と基準時間の計算
    const trainList = document.getElementById('train-list');
    const trainNotice = document.getElementById('train-notice');

    let referenceBus = boardedBus ? boardedBus : (nextBuses.length > 0 ? nextBuses[0] : null);
    let baseArrivalMins = 0;
    let isHankyu = (SETTINGS.trainLine === 'hankyu');

    if (referenceBus) {
        // バスがある場合は、バスの到着時間を基準にする
        baseArrivalMins = referenceBus.mins + referenceBus.offset;
        
        if (isHankyu) {
            baseArrivalMins += 15; 
            trainNotice.textContent = boardedBus 
                ? `※乗車予定のバスに合わせて 阪急駅への移動(+15分)を考慮した ${minutesToTime(baseArrivalMins)} 以降の電車`
                : `※直近バス到着から 阪急駅への移動(+15分)を考慮した ${minutesToTime(baseArrivalMins)} 以降の電車`;
        } else {
            trainNotice.textContent = boardedBus
                ? `※乗車予定のバスが駅に到着する ${minutesToTime(baseArrivalMins)} 以降の電車`
                : `※直近のバスが駅に到着する ${minutesToTime(baseArrivalMins)} 以降の電車`;
        }
    } else {
        // バスの運行が終了している場合は、現在時刻を基準にする
        baseArrivalMins = currentMins;
        trainNotice.textContent = `※本日のバス運行は終了しました。現在時刻(${minutesToTime(baseArrivalMins)}) 以降の電車`;
    }
        
    // 基準時間以降の電車データを取得
    let targetTrainData = [];
    if (SETTINGS.trainLine === 'jr') {
        targetTrainData = (SETTINGS.trainDir === 'osaka') ? trainDataJROsaka : trainDataJRKyoto;
    } else {
        targetTrainData = (SETTINGS.trainDir === 'umeda') ? trainDataHankyuUmeda : trainDataHankyuKawaramachi;
    }

    const nextTrains = targetTrainData.filter(t => t.mins >= baseArrivalMins).slice(0, 3);
    renderTrains(nextTrains, SETTINGS.trainLine);
}

function renderBuses(buses) {
    const list = document.getElementById('bus-list');
    list.innerHTML = '';

    if (buses.length === 0) {
        list.innerHTML = '<li class="list-item">本日の運行は終了しました</li>';
        return;
    }

    buses.forEach((bus, index) => {
        const li = document.createElement('li');
        li.className = 'list-item clickable-bus';
        const arrivalTimeStr = minutesToTime(bus.mins + bus.offset);
        
        li.innerHTML = `
            <span class="time-item">${bus.timeStr}</span>
            <span class="dest-item">${bus.dest}</span>
            <span class="arrival-item">${bus.label}<br><strong>${arrivalTimeStr}</strong></span>
        `;
        
        li.onclick = () => {
            showConfirmModal(bus, false);
        };
        
        list.appendChild(li);
    });
}

function renderTrains(trains, line) {
    const list = document.getElementById('train-list');
    list.innerHTML = '';

    if (trains.length === 0) {
        list.innerHTML = '<li class="list-item">表示できる電車がありません</li>';
        return;
    }

    trains.forEach(train => {
        const typeClass = getTrainTypeClass(train.type, line);
        const li = document.createElement('li');
        li.className = 'list-item';
        li.innerHTML = `
            <span class="time-item">${train.timeStr}</span>
            <span class="type-item ${typeClass}">${train.type}</span>
            <span class="dest-item">${train.dest} 行</span>
        `;
        list.appendChild(li);
    });
}

// --- モーダル表示用関数 ---
function showConfirmModal(bus, isCancelMode) {
    const confirmModal = document.getElementById('confirm-modal');
    if (!bus) return;
    
    if (isCancelMode) {
        document.getElementById('confirm-msg').textContent = "乗車予定を取り消しますか？";
    } else {
        document.getElementById('confirm-msg').textContent = "このバスに乗車しますか？";
    }
    
    document.getElementById('confirm-bus-info').innerHTML = `
        ${bus.timeStr} 発 <br>
        <span style="font-size:0.9rem; font-weight:normal;">${bus.dest}</span>
    `;
    
    const yesBtn = document.getElementById('confirm-yes');
    yesBtn.onclick = () => {
        if (isCancelMode) {
            boardedBus = null; // 取消
        } else {
            boardedBus = bus;  // 乗車
        }
        confirmModal.style.display = 'none';
        updateDisplay();
    };
    
    confirmModal.style.display = 'flex';
}

// --- イベントリスナー設定 ---
function setupEventListeners() {
    const busTypeSelect = document.getElementById('bus-type-select');
    const trainLineSelect = document.getElementById('train-line-select');
    const trainDirSelect = document.getElementById('train-dir-select');

    busTypeSelect.addEventListener('change', (e) => {
        SETTINGS.busType = e.target.value;
        updateDisplay();
    });

    trainLineSelect.addEventListener('change', (e) => {
        SETTINGS.trainLine = e.target.value;
        
        trainDirSelect.innerHTML = ''; 
        if (SETTINGS.trainLine === 'jr') {
            trainDirSelect.innerHTML = `
                <option value="osaka">大阪方面 (姫路・西明石)</option>
                <option value="kyoto">京都方面 (京都・米原)</option>
            `;
            SETTINGS.trainDir = 'osaka';
        } else {
            trainDirSelect.innerHTML = `
                <option value="umeda">梅田・天下茶屋方面</option>
                <option value="kawaramachi">京都河原町・桂方面</option>
            `;
            SETTINGS.trainDir = 'umeda';
        }
        updateDisplay();
    });

    trainDirSelect.addEventListener('change', (e) => {
        SETTINGS.trainDir = e.target.value;
        updateDisplay();
    });

    document.getElementById('confirm-no').addEventListener('click', () => {
        document.getElementById('confirm-modal').style.display = 'none';
    });
}