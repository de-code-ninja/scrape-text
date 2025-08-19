const puppeteer = require("puppeteer");
require("dotenv").config();

const scrapeLogic = async (res) => {
  const browser = await puppeteer.launch({
    args: [
      "--disable-setuid-sandbox",
      "--no-sandbox",
      "--single-process",
      "--no-zygote",
    ],
    executablePath:
      process.env.NODE_ENV === "production"
        ? process.env.PUPPETEER_EXECUTABLE_PATH
        : puppeteer.executablePath(),
  });
  try {
    const startTime = Date.now()
  console.log("start time " +startTime);
  
  // Open new tab
  const page = await browser.newPage();

  // Go towebsite
  await page.goto('https://youtube.com', {waitUntil: "domcontentloaded" , timeout: 100000});
  await page.waitForSelector('.yt-searchbox-input');
  //   Type 'Web scraping tutorial' in search box
  await page.type('.yt-searchbox-input', 'n8n course');

//   // Click search button
  await page.click('.ytSearchboxComponentSearchButton');

  // Wait for results to load
  // Wait for video items to appear
  await page.waitForSelector('ytd-video-renderer', { timeout: 15000 });

   // Delay to let metadata load
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Scrape video data
 const videos = await page.$$eval('ytd-video-renderer', results => {
    return results.map(video => {
      const titleEl = video.querySelector('#video-title');
      const channelEl = video.querySelector('#channel-name a');
      const metaEls = video.querySelectorAll('#metadata-line span');
      // const thumbEl = video.querySelector('ytd-thumbnail img');
      // const channelLogoEl = video.querySelector('#avatar img');
      // const descEl = video.querySelector('#description-text');

      return {
        title: titleEl?.textContent.trim() || null,
        videoUrl: titleEl ? 'https://youtube.com' + titleEl.getAttribute('href') : null,
        channelName: channelEl?.textContent.trim() || null,
        channelUrl: channelEl ? 'https://youtube.com' + channelEl.getAttribute('href') : null,
        views: metaEls[0]?.textContent.trim() || null,
        uploaded: metaEls[1]?.textContent.trim() || null,
        // thumbnail: thumbEl.src,
        // channelLogo: channelLogoEl?.src || null,
        // description: descEl?.textContent.trim() || null
      };
    });
  });


    console.log("Videos found:", videos.length);

  // Loop sequentially (NOT all at once)
  for (let i = 0; i < videos.length; i++) {
    const v = videos[i];
    if (!v.videoUrl) continue;

    const videoPage = await browser.newPage();
    await videoPage.goto(v.videoUrl, { timeout: 60000 });
    await videoPage.waitForSelector("h1", { timeout: 15000 }).catch(() => {});
    await page.waitForSelector("ytd-video-owner-renderer")
    
    const videoUrl = videoPage.url()
    const videoID = new URL(videoUrl).searchParams.get("v")
    const thumbnailUrl = `https://i.ytimg.com/vi/${videoID}/maxresdefault.jpg`;
    const thumbnailLink = {thumbnailUrl}
    // Scrape extra details
    const details = await videoPage.evaluate(() => {
      const desc = document.querySelector("#description-inline-expander")?.innerText || null;
      const tags = [...document.querySelectorAll("meta[property='og:video:tag']")].map(el => el.getAttribute("content"));
      const channelLogo = document.querySelector('ytd-video-owner-renderer #avatar img')?.src;
      return { desc, tags , channelLogo };
    });

    console.log(`✅ Video ${i + 1}:`, { ...v, ...details , ...thumbnailLink });

    await videoPage.close(); // close tab before moving to next
  }

  // Keep browser open for 10 seconds so you can see results
  // await new Promise(resolve => setTimeout(resolve, 1000000));
  const endTime = Date.now()
  console.log("Script end time: " + endTime);
  console.log("script ran for: " + (endTime-startTime)/1000 +"s");
    res.send("script ran for: " + (endTime-startTime)/1000 +"s");
  } catch (e) {
    console.error(e);
    res.send(`Something went wrong while running Puppeteer: ${e}`);
  } finally {
    await browser.close();
  }
};

module.exports = { scrapeLogic };
