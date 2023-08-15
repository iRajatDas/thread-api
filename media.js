const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const getPostData = async (id) => {
  const response = await fetch("https://www.threads.net/api/graphql", {
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-asbd-id": "129477",
      "x-fb-friendly-name": "BarcelonaPostPageQuery",
      "x-fb-lsd": "N1RcROyvW2TeIOAP1NF1Rw",
      "x-ig-app-id": "238260118697367",
    },
    body: new URLSearchParams({
      lsd: "N1RcROyvW2TeIOAP1NF1Rw",
      variables: `{"postID":"${id}"}`,
      doc_id: 5587632691339264,
    }),
    method: "POST",
  });
  const data = await response.json();
  return data;
};

const getPostId = async (url) => {
  const response = await fetch(url);
  const text = await response.text();
  const postId = text.match(/{"post_id":"(.*?)"}/);
  return postId[1];
};

const getAllMedia = async (url) => {
  const postId = await getPostId(url);
  const postData = await getPostData(postId);
  const allMedia = postData.data.data.containing_thread.thread_items.map(
    (thread) => getMedia(thread)
  );
  return allMedia;
};

const getMedia = (thread) => {
  let media = thread.post;
  media = media.text_post_app_info.share_info.quoted_post || media; // quoted post
  media = media.text_post_app_info.share_info.reposted_post || media; // reposted post

  if (media.carousel_media) {
    const carouselMedia = media.carousel_media;
    const videos = carouselMedia.filter((item) => item.video_versions);
    const photos = carouselMedia.filter((item) => !item.video_versions);

    if (videos.length > 0) {
      return {
        user: media.user,
        type: "videos",
        media: videos.map((item) => item.video_versions[0]),
        photos: videos.map((item) => item.image_versions2.candidates[0] || []),
        width: media.original_width,
        height: media.original_height,
      };
    } else if (photos.length > 0) {
      return {
        user: media.user,
        type: "photos",
        media: photos.map((item) => item.image_versions2.candidates[0]),
        width: media.original_width,
        height: media.original_height,
      };
    }
  }

  if (media.video_versions && media.video_versions.length > 0) {
    return {
      user: media.user,
      type: "videos",
      media: [...media.video_versions],
      width: media.original_width,
      height: media.original_height,
    };
  }

  return {
    user: media.user,
    type: "photo",
    media: media.image_versions2.candidates,
    width: media.original_width,
    height: media.original_height,
  };
};

module.exports = { getAllMedia, getMedia };
