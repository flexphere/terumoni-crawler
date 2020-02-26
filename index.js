const mysql = require('mysql');
const moment = require('moment');
const axios = require('axios');

// Teruteru DataURL
const URL = 'http://teru2.mieruka-honpo.com/common/chart_ct.php';

// Database settings
const DB_CONFIG = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
};

// DB接続
const connectDB = () => {
    return new Promise((resolve, reject) => {
        const con = mysql.createConnection(DB_CONFIG);
        con.connect(err => {
            if (err) reject(err);
            console.log('db connected');
            resolve(con);
        });
    });
};

// DB切断
const disconnectDB = (con) => {
    return new Promise((resolve, reject) => {
        con.end((err) => {
            if (err) reject(err);
            console.log('db disconnected');
            resolve(true);
        });
    });
};

//発電所情報取得
const getPlants = (con) => {
    return new Promise((resolve, reject) => {
        con.query(`select * from plants`, (err, rows, fields) => {
            if (err) reject(err);
            resolve(rows);
        });
    });
};

//発電量情報をDBに保存
const insertData = (con, data) => {
    return new Promise((resolve, reject) => {
        const q = `
            INSERT INTO logs (plant_id, time, ct00, ct01, ct02, ct03) 
            VALUES ('${data.plant_id}','${data.time}',${data.ct00},${data.ct01},${data.ct02},${data.ct03});
        `;
        con.query(q, (err, rows, fields) => {
            if (err) reject(err);
            resolve(rows);
        });
    });
};


const crawl = async() => {
    try {
        const con = await connectDB();
        const plants = await getPlants(con);

        for (const plant of plants) {
            const date = moment().subtract(1, 'days').format("YYYY-MM-DD");
            const options = {
                opt: date,
                unit: Buffer.from(plant.plant_id).toString('base64'),
                phese: plant.phese,
                sensor: plant.sensor,
                storage: plant.storage
            }

            const response = await axios.get(URL, { params: options });

            response.data.map(async(data, i) => {
                if (i == 0) return;
                data.plant_id = plant.plant_id;
                data.time = `${date} ${data.time}:00`;
                await insertData(con, data);
                console.log(`Insert: ${data.plant_id} / ${data.time}`);
            });
        };

        await disconnectDB(con);
    } catch (err) {
        throw err;
    }
};

crawl();