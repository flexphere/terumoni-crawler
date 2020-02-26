const mysql = require('mysql');
const glob = require('glob');
const fs = require('fs');
const config = require('../src/config');

// db接続
const con = mysql.createConnection(config.database);
con.connect((err) => {
    if (err) throw err;
    console.log('connected to mysql');
});

const parseFiles = (file, plantID) => {
    const date = file.match(/(\d{4}-\d{2}-\d{2})/)[0]
    const json = fs.readFileSync(file);
    const data = JSON.parse(json);

    //1行目は無視
    data.shift();

    //データ整形
    dataFiltered = data.filter((d) => {
        d.plant_id = plantID;
        d.time = `${date} ${d.time}:00`;
        return d;
    })

    return dataFiltered;
}

//DBにある発電所の数だけファイルベースでインポート
con.query(`select * from plants`, (err, rows, fields) => {
    if (err) {
        console.log(err);
        throw err;
    }

    rows.forEach(row => {
        const plantID = row.plant_id;
        const files = glob.sync(`./${plantID}/*.json`);

        files.map((file) => {
            const data = parseFiles(file, plantID);
            data.map(row => {
                const query = `INSERT INTO logs (plant_id, time, ct00, ct01, ct02, ct03) values ('${row.plant_id}', '${row.time}', ${row.ct00}, ${row.ct01}, ${row.ct02}, ${row.ct03})`;
                con.query(query, (err, res) => {
                    if (err) throw err;
                    console.log(query);
                });
            });
        });
    });

    // 切断
    con.end((err) => {
        if (err) throw err;
        console.log('disconnected to mysql');
    });
});