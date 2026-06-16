// --- 設定パラメータ ---
const SETTINGS = {
    busType: 'city', // 'city' または 'shuttle'
    trainDir: 'osaka' // 'osaka' または 'kyoto'
};

const SHUTTLE_SCHEDULE = ['14:40', '16:20', '18:00'];

let cityBusData = [];
let trainDataOsaka = [];
let trainDataKyoto = [];

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
        const [busRes, trainOsakaRes, trainKyotoRes] = await Promise.all([
            fetch('Excelfile/関西大学バス時刻表_平日.csv'),
            fetch('Excelfile/高槻駅時刻表_姫路西明石方面.csv'),
            fetch('Excelfile/高槻駅時刻表 _京都米原方面.csv')
        ]);

        const busText = await busRes.text();
        const trainOsakaText = await trainOsakaRes.text();
        const trainKyotoText = await trainKyotoRes.text();

        cityBusData = parseCSV(busText, 3, 1, -1, 2); 
        trainDataOsaka = parseCSV(trainOsakaText, 2, 1, 2, 3); 
        trainDataKyoto = parseCSV(trainKyotoText, 2, 1, 2, 3); 
    } catch (error) {
        console.error("データの読み込みに失敗しました:", error);
        alert("時刻表データの読み込みに失敗しました。ExcelfileフォルダとCSVファイル名を確認してください。");
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

// 文字列から電車の種別CSSクラスを取得
function getTrainTypeClass(typeStr) {
    if (typeStr.includes('特急')) return 'type-limited-express';
    if (typeStr.includes('新快速')) return 'type-special-rapid';
    if (typeStr.includes('快速')) return 'type-rapid';
    if (typeStr.includes('普通')) return 'type-local';
    return 'type-local'; // デフォルト
}

// --- メイン表示更新ロジック ---
function updateDisplay() {
    const currentMins = getCurrentMinutes();
    
    const busTitleText = SETTINGS.busType === 'city' ? '次のバス (市営バス)' : '次のバス (シャトルバス)';
    document.getElementById('bus-section-title').textContent = `🚌 ${busTitleText}`;

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

    if (nextBuses.length > 0) {
        const firstBusArrivalMins = nextBuses[0].mins + nextBuses[0].offset;
        const arrivalTimeStr = minutesToTime(firstBusArrivalMins);
        
        document.getElementById('train-notice').textContent = `※直近のバスが駅に到着する ${arrivalTimeStr} 以降の電車`;
        
        const targetTrainData = SETTINGS.trainDir === 'osaka' ? trainDataOsaka : trainDataKyoto;
        const nextTrains = targetTrainData.filter(t => t.mins >= firstBusArrivalMins).slice(0, 3);
        renderTrains(nextTrains);
    } else {
        document.getElementById('train-notice').textContent = "本日のバス運行は終了しました";
        document.getElementById('train-list').innerHTML = '<li class="list-item">表示できる電車がありません</li>';
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

function renderTrains(trains) {
    const list = document.getElementById('train-list');
    list.innerHTML = '';

    if (trains.length === 0) {
        list.innerHTML = '<li class="list-item">表示できる電車がありません</li>';
        return;
    }

    trains.forEach(train => {
        const typeClass = getTrainTypeClass(train.type);
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

function setupEventListeners() {
    const modal = document.getElementById('settings-modal');
    const settingsBtn = document.getElementById('settings-btn');
    const saveBtn = document.getElementById('save-btn');

    settingsBtn.addEventListener('click', () => {
        document.getElementById('bus-type').value = SETTINGS.busType;
        document.getElementById('train-dir').value = SETTINGS.trainDir;
        modal.classList.remove('hidden');
    });

    saveBtn.addEventListener('click', () => {
        SETTINGS.busType = document.getElementById('bus-type').value;
        SETTINGS.trainDir = document.getElementById('train-dir').value;
        modal.classList.add('hidden');
        updateDisplay(); 
    });
}