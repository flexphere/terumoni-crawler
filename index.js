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

//発電量情報の存在確認
const dataExists = (con, data) => {
    return new Promise((resolve, reject) => {
        const q = `SELECT count(*) as cnt FROM logs where plant_id = ? AND time = ?;`;
        con.query(q, [data.plant_id, data.time], (err, rows, fields) => {
            if (err) reject(err);
            const result = (rows.length && rows[0].cnt > 0) ? true : false;
            resolve(result);
        });
    });
};

//発電量情報を追加
const insertData = (con, data) => {
    return new Promise(async(resolve, reject) => {
        const q = `
            INSERT INTO logs (plant_id, time, ct00, ct01, ct02, ct03, total) 
            VALUES ('${data.plant_id}','${data.time}',${data.ct00},${data.ct01},${data.ct02},${data.ct03},${data.total});
        `;
        console.log(q);
        con.query(q, (err, rows, fields) => {
            if (err) reject(err);
            resolve(rows);
        });
    });
};

//発電量情報を更新
const updateData = (con, data) => {
    return new Promise(async(resolve, reject) => {
        const q = `
            UPDATE logs 
            SET ct00 = ${data.ct00}, ct01 = ${data.ct01}, ct02 = ${data.ct02}, ct03 = ${data.ct03}, total = ${data.ct03}
            WHERE plant_id = '${data.plant_id}' AND time = '${data.time}';
        `;
        console.log(q);
        con.query(q, (err, rows, fields) => {
            if (err) reject(err);
            resolve(rows);
        });
    });
};


const crawl = async() => {
    const con = await connectDB();
    try {
        const plants = await getPlants(con);

        for (const plant of plants) {
            // in JST
            // const date = moment().subtract(1, 'days').format("YYYY-MM-DD");

            // in UTC
            const date = moment().format("YYYY-MM-DD");
            const options = {
                opt: date,
                unit: Buffer.from(plant.plant_id).toString('base64'),
                phese: plant.phese,
                sensor: plant.sensor,
                storage: plant.storage
            }

            const response = await axios.get(URL, { params: options });
            response.data.shift();
            for (data of response.data) {
                data.plant_id = plant.plant_id;
                data.time = `${date} ${data.time}:00`;
                data.total = data.ct00 + data.ct01 + data.ct02 + data.ct03;
                const exists = await dataExists(con, data)
                if (exists) {
                    await updateData(con, data);
                } else {
                    await insertData(con, data);
                }
            }
        };
    } catch (err) {
        console.log(err.stack)
    } finally {
        await disconnectDB(con);
    }
};

crawl();