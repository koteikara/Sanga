function generateTweet() {
    let isRequest = document.getElementById("request").checked;
    let isOffer = document.getElementById("offer").checked;
    let offerItem = document.getElementById("offer-item").value;
    let requestItem = document.getElementById("request-item").value;
    let condition = document.getElementById("condition").value;
    let method = document.getElementById("method").value;

    let tweet = "";

    if (isOffer && offerItem) {
        tweet += `【譲】${offerItem}\n`;
    }

    if (isRequest && requestItem) {
        tweet += `【求】${requestItem}\n`;
    }

    if (condition) {
        tweet += `希望：${condition}\n`;
    }

    if (method) {
        tweet += `受け渡し方法：${method}\n`;
    }

    // ハッシュタグを追加
    let hashtags = ["#京都サンガ交換希望"];
    if (isRequest) hashtags.push("#求");
    if (isOffer) hashtags.push("#譲");
    if (offerItem) hashtags.push(`#${offerItem.replace(/ /g, "")}`);
    if (requestItem) hashtags.push(`#${requestItem.replace(/ /g, "")}`);

    tweet += "\n" + hashtags.join(" ");

    document.getElementById("tweetText").value = tweet;
    updateCharCount(tweet);
}

function copyText() {
    let textArea = document.getElementById("tweetText");
    textArea.select();
    document.execCommand("copy");
    alert("コピーしました！");
}

function tweetNow() {
    let text = document.getElementById("tweetText").value;
    if (text.length > 140) {
        alert("投稿が140文字を超えています。短縮してください。");
        return;
    }
    let url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
}

// 文字数カウント更新
function updateCharCount(tweet) {
    let charCount = tweet.length;
    let charCountElement = document.getElementById("charCount");

    charCountElement.textContent = `文字数: ${charCount} / 140`;

    if (charCount > 140) {
        charCountElement.classList.add("exceeded");
    } else {
        charCountElement.classList.remove("exceeded");
    }
}
