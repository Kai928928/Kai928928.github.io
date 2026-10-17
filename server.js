// 九分学长考雅机考平台 —— iPad/浏览器版 本地/局域网服务 + 可选同源代理
//
// 用途：
//   1) 在本机或局域网启动一个静态服务器，iPad 连同一 WiFi 即可打开使用。
//   2) 提供 /api 同源代理，规避个别环境下 CORS 限制（默认前端已走官方接口直连，
//      若要改用同源代理，把 index.html 里的 __APP_CONFIG__ 三个 URL 改为相对路径：
//        practiceApiBaseUrl: "/api",
//        userAuthApiBaseUrl: "/api",
//        apiBaseUrl:        "/api/listen"
//      这样所有请求都打到这里，由本服务器转发到 www.9fnnn.com，天然同源无 CORS 问题。
//
// 运行： node server.js   （默认端口 8080，可用 PORT=xxxx node server.js 修改）

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;
const API_HOST = "www.9fnnn.com";
const API_PREFIX = "/api"; // 需要代理转发的前缀

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf"
};

function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

function proxyApi(req, res) {
  const options = {
    hostname: API_HOST,
    path: req.url, // 已带 /api...
    method: req.method,
    headers: filterHeaders(req.headers)
  };
  const p = https.request(options, (upRes) => {
    const h = Object.assign({}, upRes.headers);
    h["access-control-allow-origin"] = req.headers.origin || "*";
    h["access-control-allow-headers"] = "token, content-type";
    h["access-control-allow-credentials"] = "true";
    res.writeHead(upRes.statusCode, h);
    upRes.pipe(res);
  });
  p.on("error", (e) => {
    res.writeHead(502);
    res.end("proxy error: " + e.message);
  });
  req.pipe(p);
}

function filterHeaders(h) {
  const out = {};
  for (const [k, v] of Object.entries(h)) {
    const lk = k.toLowerCase();
    if (lk === "host" || lk === "connection" || lk === "content-length") continue;
    out[k] = v;
  }
  return out;
}

const server = http.createServer((req, res) => {
  if ((req.url || "").startsWith(API_PREFIX)) {
    proxyApi(req, res);
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("ielts-web 已启动：");
  console.log("  本机：  http://localhost:" + PORT);
  console.log("  局域网：http://<本机IP>:" + PORT + "  (iPad 连同一 WiFi 打开即可)");
});
