const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { createWriteStream } = require('fs');
const { join } = require('path');
const { getAllMedia } = require('./media');
const puppeteer = require('puppeteer')


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
          console.error('Error deleting file:', err);
        }
      });
    } catch (err) {
      console.error('Error deleting file:', err);
    }
  }, timeInMilliseconds);
};

const downloadVideo = async (url) => {
  try {
    const response = await axios.get(url, { responseType: 'stream' });

    const videoFileName = `Video_(InstaThreadsDown.com)_${Date.now()}.mp4`;
    const videoFilePath = path.join(__dirname, 'videos', videoFileName);

    const videoStream = response.data.pipe(createWriteStream(videoFilePath));
    videoStream.on('finish', () => {
      deleteFileAfterTime(videoFilePath, 60 * 60 * 1000);
      delete ongoingDownloads[url];
    });

    ongoingDownloads[url] = videoFileName;
    return videoFileName;
  } catch (error) {
    delete ongoingDownloads[url];
    throw new Error('An error occurred while downloading the video.');
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
  if (media.type === 'photo') {
    media.media = media.media.filter(
      (m) => m.height === media.height && m.width === media.width
    );
  }

  return media.media.map((m, i) => {
    let url = m.url;
    const fileName = media.type.includes('video') ? `video-${i}.mp4` : `original-${i}.jpg`;
    const filePath = join(location, fileName);
    return { url, fileName, filePath };
  });
};

app.get('/api/insta', async (req, res) => {


  const { u } = req;

  // const POST_URL = 'https://www.threads.net/t/CugT0dVpUCK';
  const LOCATION = 'download';

  if (!fs.existsSync(LOCATION)) fs.mkdirSync(LOCATION);
  let postData = await getAllMedia(u);
  res.status(200).json({ status: 'success', data: postData });
});

app.get('/scrape', async (req, res) => {
  try {
    const browser = await puppeteer.launch({
      headless: true, // Change to false if you need to see the browser
    });

    const page = await browser.newPage();

    await page.goto('https://www.threads.net/t/CugT0dVpUCK', { waitUntil: "networkidle2" });

    const textContent = await page.evaluate(() => {
      const containingThreadScript = Array.from(document.querySelectorAll(`script:not([src])`))
        .find(script => script.innerText.includes('containing_thread'));

      return containingThreadScript ? JSON.parse(containingThreadScript.innerText) : null;
    });

    await browser.close();

    if (textContent) {
      const threads = textContent.require[0][3][0].__bbox.require[0][3][1].__bbox.result.data.data.containing_thread;
      res.status(200).json({ status: 'success', data: threads });
    } else {
      res.status(404).json({ error: 'Data not found.' });
    }
  } catch (error) {
    console.error('Error scraping content:', error);
    res.status(500).json({ error: 'An error occurred while scraping content.' });
  }
});


app.post('/getVideo', async (req, res) => {
  const { url } = req.body;

  if (Object.keys(ongoingDownloads).length >= MAX_CONCURRENT_DOWNLOADS) {
    return res.status(429).json({ status: 'error', message: 'Too many concurrent downloads.' });
  }

  if (ongoingDownloads[url]) {
    return res.status(200).json({ status: 'pending', message: 'Download in Progress' });
  }

  try {
    const videoFileName = await downloadVideo(url);
    res.status(200).json({ status: 'success', videoUrl: `/videos/${videoFileName}` });
  } catch (error) {
    console.error('Error downloading video:', error);
    res.status(500).json({ error: 'An error occurred while downloading the video.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
