// --- 設定パラメータ ---
const SETTINGS = {
    busType: 'city', // 'city', 'shuttle'
    trainLine: 'jr', // 'jr', 'hankyu'
    trainDir: 'osaka' // JR: 'osaka', 'kyoto' / 阪急: 'umeda', 'kawaramachi'
};

const SHUTTLE_SCHEDULE = ['14:40', '16:20', '18:00'];

let cityBusData = [];
let trainDataJROsaka = [];
let trainDataJRKyoto = [];
let trainDataHankyuKawaramachi = [];

// --- アプリケーション初期化 ---
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    await fetchAllData();
    updateDisplay();
    setInterval(updateDisplay, 60000);
});

// --- CSVデータの取得と解析 ---
async function fetchAllData() {
    try {
        const [busRes, jrOsakaRes, jrKyotoRes, hkKawaramachiRes] = await Promise.all([
            fetch('Excelfile/関西大学バス時刻表_平日.csv'),
            fetch('Excelfile/高槻駅時刻表_姫路西明石方面.csv'),
            fetch('Excelfile/高槻駅時刻表 _京都米原方面.csv'),
            fetch('Excelfile/高槻市駅時刻表_阪急京都方面_平日.csv')
        ]);

        const busText = await busRes.text();
        const jrOsakaText = await jrOsakaRes.text();
        const jrKyotoText = await jrKyotoRes.text();
        const hkKawaText = await hkKawaramachiRes.text();

        cityBusData = parseCSV(busText, 3, 1, -1, 2); 
        trainDataJROsaka = parseCSV(jrOsakaText, 2, 1, 2, 3); 
        trainDataJRKyoto = parseCSV(jrKyotoText, 2, 1, 2, 3); 
        trainDataHankyuKawaramachi = parseCSV(hkKawaText, 2, 1, 2, 3); // 阪急CSVパース
    } catch (error) {
        console.error("データの読み込みに失敗しました:", error);
        alert("時刻表データの読み込みに失敗しました。Excelfileフォルダと4つのCSVファイル名を確認してください。");
    }
}

function parseCSV(csvText, skipRows, timeColIndex, typeColIndex, destColIndex) {
    const lines = csvText.trim().split('\n');
    const result = [];
    
    for (let i = skipRows; i < lines.length; i++) {
        const cols = lines[i].split(',');
        if (cols.length > timeColIndex && cols[timeColIndex].includes(':')) {
            const timeStr = cols[timeColIndex].trim();
            const typeText = typeColIndex !== -1 ? cols[typeColIndex].trim() : '';
            const destText = destColIndex !== -1 ? cols[destColIndex].trim() : '';
            
            result.push({
                timeStr: timeStr,
                mins: timeToMinutes(timeStr),
                type: typeText,
                dest: destText
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

// 路線の種別ごとにCSSクラスを割り振る
function getTrainTypeClass(typeStr, line) {
    if (line === 'hankyu') {
        if (typeStr.includes('快速特急')) return 'type-hk-rapid-ltd'; // 紫
        if (typeStr.includes('特急')) return 'type-ltd-exp'; // 赤 (特急・準特急・通勤特急)
        if (typeStr.includes('急行')) return 'type-hk-exp'; // 黄
        if (typeStr.includes('快速')) return 'type-blue-rapid'; // 青
        if (typeStr.includes('準急')) return 'type-hk-semi'; // 緑
        return 'type-local'; // 白
    } else {
        // JR
        if (typeStr.includes('特急')) return 'type-ltd-exp'; // 赤
        if (typeStr.includes('新快速')) return 'type-blue-rapid'; // 青
        if (typeStr.includes('快速')) return 'type-jr-rapid'; // オレンジ
        return 'type-local'; // 白
    }
}

// --- メイン表示更新ロジック ---
function updateDisplay() {
    const currentMins = getCurrentMinutes();

    // 1. バスの制御
    const reservationBox = document.getElementById('shuttle-reservation');
    if (SETTINGS.busType === 'shuttle') {
        reservationBox.classList.remove('hidden');
    } else {
        reservationBox.classList.add('hidden');
    }

    let nextBuses = [];
    if (SETTINGS.busType === 'city') {
        const filtered = cityBusData.filter(b => b.mins >= currentMins).slice(0, 3);
        nextBuses = filtered.map(b => ({
            timeStr: b.timeStr,
            mins: b.mins,
            dest: b.dest,
            offset: 30,
            label: '到着時刻'
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

    renderBuses(nextBuses);

    // 2. 電車の制御
    const trainList = document.getElementById('train-list');
    const trainNotice = document.getElementById('train-notice');

    if (nextBuses.length > 0) {
        // バス到着時間
        let baseArrivalMins = nextBuses[0].mins + nextBuses[0].offset;
        
        // 阪急の場合は+15分の移動時間を追加
        let isHankyu = (SETTINGS.trainLine === 'hankyu');
        if (isHankyu) {
            baseArrivalMins += 15;
            trainNotice.textContent = `※バス到着時間から阪急駅への移動(+15分)を考慮した ${minutesToTime(baseArrivalMins)} 以降の電車`;
        } else {
            trainNotice.textContent = `※直近のバスが駅に到着する ${minutesToTime(baseArrivalMins)} 以降の電車`;
        }
        
        // 対象のデータを取得
        let targetTrainData = [];
        if (SETTINGS.trainLine === 'jr') {
            targetTrainData = (SETTINGS.trainDir === 'osaka') ? trainDataJROsaka : trainDataJRKyoto;
        } else {
            if (SETTINGS.trainDir === 'umeda') {
                // 梅田方面はデータなしのため特殊処理
                trainList.innerHTML = '<li class="list-item" style="color:#fcd34d;">梅田・天下茶屋方面は COMING SOON...</li>';
                return;
            } else {
                targetTrainData = trainDataHankyuKawaramachi;
            }
        }

        const nextTrains = targetTrainData.filter(t => t.mins >= baseArrivalMins).slice(0, 3);
        renderTrains(nextTrains, SETTINGS.trainLine);

    } else {
        trainNotice.textContent = "本日のバス運行は終了しました";
        trainList.innerHTML = '<li class="list-item">表示できる電車がありません</li>';
    }
}

function renderBuses(buses) {
    const list = document.getElementById('bus-list');
    list.innerHTML = '';

    if (buses.length === 0) {
        list.innerHTML = '<li class="list-item">本日の運行は終了しました</li>';
        return;
    }

    buses.forEach(bus => {
        const arrivalTimeStr = minutesToTime(bus.mins + bus.offset);
        const li = document.createElement('li');
        li.className = 'list-item';
        li.innerHTML = `
            <span class="time-item">${bus.timeStr}</span>
            <span class="dest-item">${bus.dest}</span>
            <span class="arrival-item">${bus.label}<br><strong>${arrivalTimeStr}</strong></span>
        `;
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

// --- イベントリスナー設定 ---
function setupEventListeners() {
    const busTypeSelect = document.getElementById('bus-type-select');
    const trainLineSelect = document.getElementById('train-line-select');
    const trainDirSelect = document.getElementById('train-dir-select');

    // バス種類の変更
    busTypeSelect.addEventListener('change', (e) => {
        SETTINGS.busType = e.target.value;
        updateDisplay();
    });

    // 路線(JR/阪急)の変更時に方面を切り替える
    trainLineSelect.addEventListener('change', (e) => {
        SETTINGS.trainLine = e.target.value;
        
        trainDirSelect.innerHTML = ''; // 一旦クリア
        
        if (SETTINGS.trainLine === 'jr') {
            trainDirSelect.innerHTML = `
                <option value="osaka">大阪方面 (姫路・西明石)</option>
                <option value="kyoto">京都方面 (京都・米原)</option>
            `;
            SETTINGS.trainDir = 'osaka';
        } else {
            trainDirSelect.innerHTML = `
                <option value="kawaramachi">京都河原町・桂方面</option>
                <option value="umeda">梅田・天下茶屋方面</option>
            `;
            SETTINGS.trainDir = 'kawaramachi';
        }
        updateDisplay();
    });

    // 方面の変更
    trainDirSelect.addEventListener('change', (e) => {
        SETTINGS.trainDir = e.target.value;
        updateDisplay();
    });
}