import ThreadsAPI from "threads-api";

const threadsAPI = new ThreadsAPI.ThreadsAPI({
  username: "rajatdas.me",
  password: "rajatdas@123#S$"
});

async function getPostId(ThreadId) {
  const postId = await getPostIDfromThreadID(ThreadId);
  if (!postId) {
    throw new Error("Failed to fetch data");
  }
  return postId;
}

async function getPostDetailsWithoutId(threadId) {
  const postID = await threadsAPI.getPostIDfromThreadID("Cv1dd8nJnWs");
  if (!postID) {
    return;
  }
  const postData = await threadsAPI.getThreads(postID);
  if (!postData) {
    throw new Error("Failed to fetch data");
  }
  return postData;
}

const data = await getPostDetailsWithoutId();

await threadsAPI.publish({
  text: "🤖 Threads with Image",
  attachment: {
    image: "https://github.com/junhoyeo/threads-api/raw/main/.github/cover.jpg",
  },
});