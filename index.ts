import config from './config.json';
import { queue } from "async";
import { Client } from "ssh2";
import * as byline from 'byline';

const conn = new Client();
var ones: number = 0;
var zeros: number = 0;

async function start() {
    console.log('connecting...');

    conn.on('ready', async () => {
        console.log('transversing files/folders...');

        transverse().then((files: string[]) => {
            console.log(`found ${files.length} file(s)`);

            iterate(files);
        }).catch((error: any) => {
            conn.end();

            console.error(`transversing:: ERROR: ${error}`);
        });
    });

    conn.connect({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
    });
}

async function transverse() {
    var dirs: string[] = [];
    var files: string[] = [];

    var curdir: string = "";

    return new Promise<string[]>((resolve, reject) => {
        conn.exec("ls -aR", (error: any, stream: any) => {
            if (typeof error !== 'undefined') {

                reject(new Error(error));
            } else {
                stream = byline.createStream(stream);
                stream.on('data', (data: any) => {
                    var name: string = data.toString();
                    if (name.endsWith(":")) {
                        curdir = name.slice(0, -1);
                        dirs.push(curdir);
                    } else {
                        if (!name.startsWith(".")) {
                            var file: string = `${curdir}/${name}`;
                            files.push(file)
                        }
                    }
                }).on('close', (code: any, signal: any) => {
                    dirs = []

                    resolve(files);
                }).on('error', (error: any) => {
                    // console.error(`transverse:: ERROR: ${error}`);

                    reject(new Error(error));
                });
            }
        });
    });
}

async function process(file: any) {
    var countOfOnes: number = 0;
    var countOfZeros: number = 0;

    return new Promise<number[]>((resolve, reject) => {
        conn.exec(`cat ${file}`, (error: any, stream: any) => {
            if (typeof error !== 'undefined') {

                reject(new Error(error));
            } else {
                stream = byline.createStream(stream);
                stream.on('data', (data: any) => {
                    var line: string = data.toString();

                    for (var i: number = 0; i < line.length; i++) {
                        if (line[i] == '1') {
                            countOfOnes++;
                        } else if (line[i] == '0') {
                            countOfZeros++;
                        }
                    }
                }).on('close', (code: any, signal: any) => {
                    resolve([countOfZeros, countOfOnes]);
                }).on('error', (error: any) => {

                    reject(new Error(error));
                });
            }
        });
    });
}

async function iterate(files: string[]) {
    console.log(`processing files...`);

    var count: number = 0;
    var fileQueue = queue((file: any, callback: any) => {
        process(file).then((result: number[]) => {
            zeros += result[0];
            ones += result[1];

            count++;
            console.log(`processed ${count}: ${file}: z/o: ${result[0]}/${result[1]} total: ${zeros}/${ones}`)

            callback();
        }).catch((error: any) => {
            console.error(`processing:: ERROR: ${error}`);

            callback();
        });
    }, 1);

    fileQueue.drain(() => {
        console.log(``);
        console.log(`count of 0s: ${zeros}, count of 1s: ${ones}`);

        conn.end();
    });

    fileQueue.error((error: any, task: any) => {
        console.error(`iterate:: ERROR: ${error}`);

        conn.end();
    });

    files.forEach((file) => {
        fileQueue.push(file);
    })

    await fileQueue.drain()
}

start();

export { };

