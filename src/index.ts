import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as querystring from 'node:querystring';
import { ago } from './ago.js';

const MAX_BUFFER_SIZE = 10;
const MAX_BUG_STRSIZE = 1024;
const MAX_BUG_STRSIZE_GRACE = 32;

const FUTURE = "the future (is server clock broken?)";

interface BugRcd {
    bug: string,
    ip: string,
    timestamp: Date
}

const buffers: Map<string, BugRcd[]> = new Map(); // maps IP address to buffer of submissions
let visited: Set<string> = new Set();

const srv = http.createServer(async (req, res) => {
    if (req.method == "GET" && (req.url == "" || req.url == "/" || req.url == "/index.html" || req.url == "/index.html/")) {
        const posts = await fs.readFile("static/index.html", "utf8");

        const agoPosts = posts.replace(/(?<=<small class="date" title="(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)">).*(?=<\/small>)/g, (_, ts) => ago(new Date(ts), FUTURE)).replace(/<!--(<script type="module" src="\/js\/tick-script\.js"><\/script>)-->/g, "$1");

        res.writeHead(200);
        res.end(agoPosts);
    } else if (req.method == "GET" && (req.url == "/posts" || req.url == "/posts/" || req.url == "/posts/index.html" || req.url == "/posts/index.html/")) {
        const posts = await fs.readFile("static/posts/index.html", "utf8");

        const agoPosts = posts.replace(/(?<=<small class="date" title="(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)">).*(?=<\/small>)/g, (_, ts) => ago(new Date(ts), FUTURE));

        res.writeHead(200);
        res.end(agoPosts);
    } else if (req.method == "POST" && (req.url == "/bug" || req.url == "/bug/")) {
        const timestamp = new Date();
        const sockAddr = req.socket.address();
        const ip = (req.headers["x-forwarded-for"] as Exclude<typeof req["headers"]["x-forwarded-for"], string[]>) ?? ("address" in sockAddr ? sockAddr.address : "0.0.0.0");

        const chunks: Buffer[] = [];

        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => {
            const string = Buffer.concat(chunks).toString();

            let parts;
            try {
                parts = querystring.parse(string);
            } catch (err) {
                res.writeHead(400);
                res.end();
                return;
            }

            const bugVal = parts["bug"];

            if (bugVal === undefined || Array.isArray(bugVal) && bugVal.length != 1) {
                res.writeHead(400);
                res.end();
                return;
            }

            const bug: string = Array.isArray(bugVal) ? bugVal[0] : bugVal;

            if ([...bug].length > MAX_BUG_STRSIZE + MAX_BUG_STRSIZE_GRACE) {
                res.writeHead(400);
                res.end();
                return;
            }

            if (bug != "") {
                const buffer = buffers.get(ip);

                if (buffer === undefined) {
                    console.log("writing first bug to ip: " + ip);

                    buffers.set(ip, [{
                        bug,
                        ip,
                        timestamp
                    }]);
                } else {
                    if (buffer.length >= MAX_BUFFER_SIZE) {
                        console.log("full buffer for ip: " + ip);

                        res.writeHead(403);
                        res.end();
                        return;
                    } else {
                        console.log("writing bug to ip (bufsize " + buffer.length + "): " + ip);

                        buffer.push({
                            bug,
                            ip,
                            timestamp
                        });
                    }
                }
            }

            res.writeHead(204);
            res.end();
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

srv.listen(8124);

const fileHandle = await fs.open("bugs.jsonl", "a");

async function writeBug(rcd: BugRcd) {
    await fileHandle.appendFile(JSON.stringify({
        bug: rcd.bug,
        ip: rcd.ip,
        rcvdTs: rcd.timestamp.toISOString(),
        wrTs: new Date().toISOString()
    }) + "\n", "utf8");

    await fileHandle.datasync();
}

let int: ReturnType<typeof setTimeout> | null = null;

async function tickBuffer() {
    try {
        const unvisited = [...buffers.entries()].filter(([ip, buffer]) => buffer.length != 0 && !visited.has(ip)).map(([ip, _]) => ip).sort();

        if (unvisited.length == 0) {
            const ips = [...buffers.entries()].filter(([_, buffer]) => buffer.length != 0).map(([ip, _]) => ip).sort();

            if (ips.length == 0) {
                visited = new Set();
            } else {
                const ip = ips[0];

                console.log("tickBuffer: 0 unvisited; " + ips.length + " buffering; choosing " + ip);

                await writeBug(buffers.get(ip)!.shift()!);
                visited = new Set([ip]);
            }
        } else {
            const ip = unvisited[0];

            console.log("tickBuffer: " + unvisited.length + " unvisited; choosing " + ip);

            await writeBug(buffers.get(ip)!.pop()!);
            visited.add(ip);
        }

        int = setTimeout(tickBuffer, 200);
    } catch (err) {
        srv.close();

        throw err;
    }
}

tickBuffer();

srv.on("close", () => {
    if (int != null) {
        clearInterval(int);
        int = null;
    }
});