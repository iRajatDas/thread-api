const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { createWriteStream } = require("fs");
const { join } = require("path");
const { getAllMedia, getMedia } = require("./media");
const puppeteer = require("puppeteer");
const proxy = require('pass-cors')

const app = express();
const PORT = 3001;

app.use(express.json());
app.use(cors());
app.use(helmet());

const MAX_CONCURRENT_DOWNLOADS = 3;
const ongoingDownloads = {};

const deleteFileAfterTime = (filePath, timeInMilliseconds) => {
  setTimeout(() => {
    try {
      fs.unlink(filePath, (err) => {
        if (err) {
          console.error("Error deleting file:", err);
        }
      });
    } catch (err) {
      console.error("Error deleting file:", err);
    }
  }, timeInMilliseconds);
};

const downloadVideo = async (url) => {
  try {
    const response = await axios.get(url, { responseType: "stream" });

    const videoFileName = `Video_(InstaThreadsDown.com)_${Date.now()}.mp4`;
    const videoFilePath = path.join(__dirname, "videos", videoFileName);

    const videoStream = response.data.pipe(createWriteStream(videoFilePath));
    videoStream.on("finish", () => {
      deleteFileAfterTime(videoFilePath, 60 * 60 * 1000);
      delete ongoingDownloads[url];
    });

    ongoingDownloads[url] = videoFileName;
    return videoFileName;
  } catch (error) {
    delete ongoingDownloads[url];
    throw new Error("An error occurred while downloading the video.");
  }
};

const downloadMedia = async (media, i = 0) => {
  i++;
  if (media.length === 0) return;
  console.log(`[${i}] Downloading ${media[0].fileName}`);
  const request = await fetch(media[0].url);
  const blob = await request.blob();
  const bos = Buffer.from(await blob.arrayBuffer());
  fs.writeFileSync(media[0].filePath, bos);
  media.shift();
  return await downloadMedia(media, i);
};

const prepareMedia = (media, location) => {
  if (media.type === "photo") {
    media.media = media.media.filter(
      (m) => m.height === media.height && m.width === media.width
    );
  }

  return media.media.map((m, i) => {
    let url = m.url;
    const fileName = media.type.includes("video")
      ? `video-${i}.mp4`
      : `original-${i}.jpg`;
    const filePath = join(location, fileName);
    return { url, fileName, filePath };
  });
};

app.get("/api/insta", async (req, res) => {
  const { u } = req;

  // const POST_URL = 'https://www.threads.net/t/CugT0dVpUCK';
  const LOCATION = "download";

  if (!fs.existsSync(LOCATION)) fs.mkdirSync(LOCATION);
  let postData = await getAllMedia(u);
  res.status(200).json({ status: "success", data: postData });
});

app.use('/proxy', proxy);  //You can customise the route name

const IS_PRODUCTION = true;

const getBrowser = () =>
  IS_PRODUCTION
    ? // Connect to browserless so we don't run Chrome on the same hardware in production
      puppeteer.connect({
        browserWSEndpoint:
          "wss://chrome.browserless.io?token=7d8dd40a-8d68-4d26-bec5-31b7be5353be",
      })
    : // Run the browser locally while in development
      puppeteer.launch();

app.get("/scrape", async (req, res) => {
  let browser = null;

  const { url } = req.query;
  if (!url) {
    res.status(404).json({ error: "Yo!" });
    return;
  }

  console.log(url);

  try {
    browser = await getBrowser();
    const page = await browser.newPage();
    const iPhone = puppeteer.devices["iPhone 12 Pro"];
    await page.emulate(iPhone);
    page.setRequestInterception(true);
    page.on("request", (request) => {
      if (
        request.resourceType() === "image" ||
        request.resourceType() === "stylesheet"
      ) {
        request.abort();
      } else {
        request.continue();
      }
    });

    await page.goto(url, {
      waitUntil: "networkidle2",
    });

    const textContent = await page.evaluate(() => {
      const containingThreadScript = Array.from(
        document.querySelectorAll(`script:not([src])`)
      ).find((script) => script.innerText.includes("containing_thread"));

      return containingThreadScript
        ? JSON.parse(containingThreadScript.innerText)
        : null;
    });

    await browser.close();

    if (textContent) {
      const threads =
        textContent.require[0][3][0].__bbox.require[0][3][1].__bbox.result.data
          .data.containing_thread;

      const allMedia = threads.thread_items.map((thread) => getMedia(thread));

      res.status(200).json({ status: "success", data: allMedia });
    } else {
      res.status(404).json({ error: "Data not found." });
    }
  } catch (error) {
    console.error("Error scraping content:", error);
    res
      .status(500)
      .json({ error: "An error occurred while scraping content." });
  }
});

app.get("/scrape___", async (req, res) => {
  const { url } = req.query;
  if (!url) {
    res.status(400).json({ error: "Missing URL parameter." });
    return;
  }

  try {
    const page = await browser.newPage();

    // Configure page settings, intercept requests, etc.

    await page.goto(url, { waitUntil: "networkidle2" });

    const textContent = await page.evaluate(() => {
      const containingThreadScript = Array.from(
        document.querySelectorAll(`script:not([src])`)
      ).find((script) => script.innerText.includes("containing_thread"));

      return containingThreadScript
        ? JSON.parse(containingThreadScript.innerText)
        : null;
    });

    await page.close();

    if (textContent) {
      const threads =
        textContent.require[0][3][0].__bbox.require[0][3][1].__bbox.result.data
          .data.containing_thread;

      const allMedia = threads.thread_items.map((thread) => getMedia(thread));

      res.status(200).json({ status: "success", data: allMedia });
    } else {
      res.status(404).json({ error: "Data not found." });
    }
  } catch (error) {
    console.error("Error scraping content:", error);
    res
      .status(500)
      .json({ error: "An error occurred while scraping content." });
  }
});

app.post("/getVideo", async (req, res) => {
  const { url } = req.body;

  if (Object.keys(ongoingDownloads).length >= MAX_CONCURRENT_DOWNLOADS) {
    return res
      .status(429)
      .json({ status: "error", message: "Too many concurrent downloads." });
  }

  if (ongoingDownloads[url]) {
    return res
      .status(200)
      .json({ status: "pending", message: "Download in Progress" });
  }

  try {
    const videoFileName = await downloadVideo(url);
    res
      .status(200)
      .json({ status: "success", videoUrl: `/videos/${videoFileName}` });
  } catch (error) {
    console.error("Error downloading video:", error);
    res
      .status(500)
      .json({ error: "An error occurred while downloading the video." });
  }
});

// Close the browser when the server is shutting down
process.on("exit", () => {
  if (browser) {
    browser.close();
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
