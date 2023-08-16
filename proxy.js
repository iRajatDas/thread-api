const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const url = require("url");
const helmet = require("helmet");

const app = express();
app.use(express.json());

// Enable CORS for all routes
app.use(helmet({ crossOriginResourcePolicy: false }));

app.use("/:hostname/*", (req, res, next) => {
  const { hostname } = req.params;
  const targetUrl = url.format({
    protocol: "https",
    host: hostname,
    pathname: req.params[0],
    query: req.query,
  });

  // Check if the request is for a video file
  if (req.params[0].endsWith(".mp4")) {
    // Proxy the video file directly
    createProxyMiddleware({
      target: targetUrl,
      changeOrigin: true,
    })(req, res, next);
  } else {
    // Construct the proxy URL and headers for other requests
    req.url = "";
    req.headers.host = hostname;

    createProxyMiddleware({
      target: targetUrl,
      changeOrigin: true,
    })(req, res, next);
  }
});

app.listen(3001, () => {
  console.log("Proxy server is running on port 3001");
});
