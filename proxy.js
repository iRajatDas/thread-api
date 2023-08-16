const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const url = require("url"); // Import the 'url' module

const app = express();

// Define a custom proxy route
app.use("/:hostname/*", (req, res, next) => {
  const { hostname } = req.params; // Get the hostname from the URL
  const targetUrl = url.format({
    protocol: "https", // Change this if necessary
    host: hostname,
    pathname: req.params[0], // Get the rest of the URL as the pathname
    query: req.query, // Preserve query parameters if any
  });

  req.url = ""; // Clear the URL so it's reconstructed based on the target URL
  req.headers.host = hostname; // Set the host header to match the hostname

  // Use http-proxy-middleware with the constructed target URL
  createProxyMiddleware({
    target: targetUrl,
    changeOrigin: true,
  })(req, res, next);
});

app.listen(3001, () => {
  console.log("Proxy server is running on port 3001");
});
