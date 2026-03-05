import http from "http";

const options = {
  hostname: "localhost",
  port: 3333,
  path: "/test/payment",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
};

const data = JSON.stringify({
  trackingNumbers: ["700181356595"],
});

console.log("Enviando petición a /test/payment...");
const req = http.request(options, (res) => {
  console.log("Status:", res.statusCode);

  let body = "";

  res.on("data", (chunk) => {
    body += chunk;
  });

  res.on("end", () => {
    console.log("Response:", body);
    process.exit(0);
  });
});

req.on("error", (e) => {
  console.error("Request error:", e.message);
  process.exit(1);
});

req.write(data);
req.end();

// Timeout de 120 segundos
setTimeout(() => {
  console.error("Timeout");
  process.exit(1);
}, 120000);

