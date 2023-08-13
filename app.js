const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { createWriteStream } = require('fs');

const app = express();
const PORT = 3000; // You can change this to your desired port

app.use(express.json());
app.use(cors());
app.use(helmet());

const MAX_CONCURRENT_DOWNLOADS = 3; // Set the maximum number of concurrent downloads
const ongoingDownloads = {}; // Object to keep track of ongoing downloads

// Helper function to delete a file after a given time
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
    const response = await axios.get(url, {
      responseType: 'stream',
    });

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

app.post('/getVideo', async (req, res) => {
  const { url } = req.body;

  if (Object.keys(ongoingDownloads).length >= MAX_CONCURRENT_DOWNLOADS) {
    return res.status(429).json({ status: 'error', message: 'Too many concurrent downloads.' });
  }

  if (ongoingDownloads[url]) {
    return res.status(200).json({ status: 'pending', message: `Download in Progress` });
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
