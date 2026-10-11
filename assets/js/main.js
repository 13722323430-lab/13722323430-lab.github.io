/* ============================================================
   刘艺非 · 个人作品集 - 全局脚本
   动效原则：柔和克制 —— 仅淡入 / 平滑滚动 / 轻微缩放
   ============================================================ */
(function () {
  "use strict";

  var isMobile = window.matchMedia("(max-width: 640px)").matches;

  /* ---------------- 导航 ---------------- */
  var burger = document.querySelector(".nav-burger");
  var drawer = document.querySelector(".nav-drawer");
  if (burger && drawer) {
    burger.addEventListener("click", function () {
      burger.classList.toggle("open");
      drawer.classList.toggle("open");
    });
    drawer.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        burger.classList.remove("open");
        drawer.classList.remove("open");
      });
    });
  }

  /* ---------------- Hero 逐字揭示 ---------------- */
  document.querySelectorAll("[data-chars]").forEach(function (el) {
    var text = el.textContent;
    el.textContent = "";
    var delay = parseFloat(el.getAttribute("data-delay") || "0");
    var accentNext = false;
    Array.from(text).forEach(function (ch) {
      if (ch === "*") { accentNext = !accentNext; return; } // *...* 包裹的字带强调色
      var span = document.createElement("span");
      span.className = "char" + (accentNext ? " accent" : "");
      if (ch === " ") { span.innerHTML = "&nbsp;"; }
      else { span.textContent = ch; }
      span.style.setProperty("--d", delay.toFixed(2) + "s");
      el.appendChild(span);
      delay += 0.055;
    });
    // 触发
    requestAnimationFrame(function () {
      setTimeout(function () { el.classList.add("chars-in"); }, 120);
    });
  });

  /* ---------------- 滚动渐显 ---------------- */
  var revealEls = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    revealEls.forEach(function (el) { io.observe(el); });
  } else {
    revealEls.forEach(function (el) { el.classList.add("is-visible"); });
  }

  /* ---------------- 横幅跑马灯：滚出视口即暂停 ----------------
     无限循环动画会一直占用合成器；页面滚到下方后它已不可见，
     继续播放纯属浪费，暂停后滚动更稳。 */
  document.querySelectorAll(".marquee-wrap").forEach(function (wrap) {
    if (!("IntersectionObserver" in window)) return;
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        wrap.classList.toggle("is-offscreen", !e.isIntersecting);
      });
    }, { threshold: 0 }).observe(wrap);
  });

  /* ---------------- Toast ---------------- */
  var toastEl = document.querySelector(".toast");
  var toastTimer = null;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2600);
  }

  /* ---------------- 图片占位（素材未放置时优雅降级） ---------------- */
  function buildPlaceholder(img) {
    var name = img.getAttribute("data-ph") || "待放置素材";
    var tip = img.getAttribute("data-ph-tip") || "将素材放入 assets 目录后自动显示";
    var div = document.createElement("div");
    div.className = "ph-img";
    div.style.minHeight = (img.getAttribute("data-ph-minh") || "200") + "px";
    if (img.parentElement) {
      div.style.height = "100%";
      if (getComputedStyle(img.parentElement).position === "static") {
        img.parentElement.style.position = "relative";
      }
    }
    div.innerHTML =
      '<div class="ph-inner">' +
      '<div class="ph-icon">🖼</div>' +
      '<div class="ph-name">' + name + "</div>" +
      '<div class="ph-tip">' + tip + "</div>" +
      "</div>";
    if (img.parentNode) img.parentNode.replaceChild(div, img);
  }
  document.querySelectorAll("img[data-ph]").forEach(function (img) {
    img.addEventListener("error", function () { buildPlaceholder(img); });
    // 检测是否已 404（缓存场景下 error 可能先于绑定触发）
    if (img.complete && img.naturalWidth === 0) buildPlaceholder(img);
  });

  /* ---------------- 视频素材检测 ---------------- */
  document.querySelectorAll("video[data-ph]").forEach(function (v) {
    v.addEventListener("error", function () {
      var cover = v.parentElement.querySelector(".player-cover");
      if (!cover) return;
      var inner = cover.querySelector(".pc-inner");
      if (inner) {
        inner.innerHTML =
          '<div class="ph-icon" style="font-size:28px">🎬</div>' +
          '<div class="pc-title">原片视频待放置</div>' +
          '<div class="pc-note">请将视频文件放入 assets/videos/ 目录（见素材放置说明），刷新后即可在页面内直接播放。</div>';
      }
      cover.classList.remove("hide");
    });
  });

  /* ---------------- 简约视频控件（闲置自动淡出 · 进度条可点击 / 拖动） ---------------- */
  document.querySelectorAll(".player").forEach(function (player) {
    var video = player.querySelector("video");
    var ui = player.querySelector(".player-ui");
    var cover = player.querySelector(".player-cover");
    if (!video || !ui) return;

    var playBtn = ui.querySelector(".pbtn-play");
    var muteBtn = ui.querySelector(".pbtn-mute");
    var progress = ui.querySelector(".progress");
    var bar = ui.querySelector(".progress .bar");
    var timeEl = ui.querySelector(".time");
    var knob = null;
    var idleTimer = null;

    function fmt(s) {
      if (!isFinite(s)) return "00:00";
      var m = Math.floor(s / 60), sec = Math.floor(s % 60);
      return (m < 10 ? "0" + m : m) + ":" + (sec < 10 ? "0" + sec : sec);
    }
    function wake() {
      ui.classList.remove("idle");
      clearTimeout(idleTimer);
      idleTimer = setTimeout(function () {
        if (!video.paused) ui.classList.add("idle");
      }, 2800);
    }
    function togglePlay() {
      if (video.paused) video.play().catch(function () {});
      else video.pause();
    }

    /* 进度条 DOM：缓存进度层 + 拖动圆点（运行时创建，避免改三个页面的 HTML） */
    var buffer = null, cacheNote = null;
    if (progress) {
      buffer = document.createElement("div");
      buffer.className = "buffer";
      progress.insertBefore(buffer, progress.firstChild);
      knob = progress.querySelector(".knob");
      if (!knob) {
        knob = document.createElement("div");
        knob.className = "knob";
        progress.appendChild(knob);
      }
      cacheNote = document.createElement("div");
      cacheNote.className = "cache-note";
      progress.parentNode.insertBefore(cacheNote, progress);
    }

    function paintRatio(ratio) {
      if (ratio < 0) ratio = 0;
      if (ratio > 1) ratio = 1;
      var pct = (ratio * 100).toFixed(3) + "%";
      if (bar) bar.style.width = pct;
      if (knob) knob.style.left = pct;
    }
    function ratioOf(clientX) {
      var rect = progress.getBoundingClientRect();
      if (!rect.width) return 0;
      var r = (clientX - rect.left) / rect.width;
      return r < 0 ? 0 : r > 1 ? 1 : r;
    }
    function seekTo(ratio) {
      if (!video.duration || !isFinite(video.duration)) return;
      var t = ratio * video.duration;
      if (isFinite(t)) video.currentTime = t;
      paintRatio(ratio);
      if (timeEl) timeEl.textContent = fmt(t) + " / " + fmt(video.duration);
    }

    /* ==========================================================
       部分静态托管（含本站所在环境）不响应 HTTP Range 请求，
       浏览器会认为视频"不可定位"，进度条怎么拖都无效。
       对策：检测到不可定位时，后台把整段视频抓成 Blob，
       加载完成后无缝换源 —— Blob 源天然支持任意定位拖动。
       ========================================================== */
    var sourceUrl = video.getAttribute("src") || "";
    var blobUrl = null, caching = false, swapped = false, pendingRatio = null;
    /* 整片缓存的内存上限。超过这个体积的视频不再全量读进内存，
       否则几十 MB 的 Blob 会造成明显的内存压力与主线程卡顿。 */
    var CACHE_LIMIT = 24 * 1024 * 1024;
    var probed = false, rangeOk = false, tooBig = false;

    function seekableNow() {
      return !!(video.seekable && video.seekable.length && video.seekable.end(0) > 0);
    }
    function note(text, show) {
      if (!cacheNote) return;
      cacheNote.textContent = text || "";
      cacheNote.classList.toggle("show", !!show);
    }
    function applyBlob(ratio) {
      if (!blobUrl || swapped) return false;
      var target = (ratio === null || ratio === undefined)
        ? video.currentTime : ratio * (video.duration || 0);
      var wasPlaying = !video.paused;
      var wasMuted = video.muted;
      swapped = true;
      pendingRatio = null;
      video.src = blobUrl;
      video.load();
      video.addEventListener("loadedmetadata", function once() {
        video.removeEventListener("loadedmetadata", once);
        try { if (isFinite(target)) video.currentTime = target; } catch (err) {}
        video.muted = wasMuted;
        paintRatio(video.duration ? video.currentTime / video.duration : 0);
        if (timeEl) timeEl.textContent = fmt(video.currentTime) + " / " + fmt(video.duration);
        if (wasPlaying) video.play().catch(function () {});
        else ui.classList.remove("idle");
      });
      return true;
    }
    /* 用一个带 Range 的 HEAD 请求一次探明两件事：
       1) 服务端是否支持 Range —— 支持就根本不需要整片缓存（GitHub Pages 属于这类）；
       2) 文件有多大 —— 太大就不值得整片读进内存。
       用 Promise 缓存结果：拖动进度条会连续触发多次 startCache，
       必须等同一次探测的结果，不能让后到的调用读到未赋值的默认值。 */
    var probePromise = null;
    function probeCache() {
      if (!probePromise) {
        probePromise = (typeof fetch === "function"
          ? fetch(sourceUrl, { method: "HEAD", headers: { Range: "bytes=0-1" } })
              .then(function (res) {
                rangeOk = res.status === 206;
                var total = parseInt(res.headers.get("content-length") || "0", 10) || 0;
                tooBig = total > CACHE_LIMIT;
              })
              .catch(function () {})
          : Promise.resolve());
      }
      return probePromise;
    }

    /* reason: "auto" = 点播放时顺手后台缓存；"user" = 用户主动拖了进度条 */
    function startCache(reason) {
      if (caching || swapped || blobUrl || !sourceUrl) return;
      if (seekableNow()) return;   // 已确认可定位，无需缓存
      if (typeof Blob !== "function" || !window.URL || !URL.createObjectURL) return;
      probeCache().then(function () {
        if (rangeOk) return;       // 支持 Range，原生就能拖动，不用折腾
        if (tooBig) {              // 体积过大：放弃整片缓存，避免几十 MB 压垮内存
          if (reason !== "auto") {
            note("该视频体积较大，未整片缓存；播放与暂停不受影响", true);
            setTimeout(function () { note("", false); }, 4200);
          }
          return;
        }
        if (caching || swapped || blobUrl) return;
        caching = true;
        note("正在缓存完整视频，之后即可拖动进度条…", true);
        /* 必须加查询参数：服务端不支持 Range 时，<video> 自己对同一 URL 的
           请求迟迟不结束，浏览器会把同 URL 的 fetch 去重挂起，永远等不到响应。 */
        var url = sourceUrl + (sourceUrl.indexOf("?") < 0 ? "?" : "&") + "fullcache=1";
        fetch(url)
          .then(function (res) {
            if (!res.ok) throw new Error("HTTP " + res.status);
            var total = parseInt(res.headers.get("content-length") || "0", 10) || 0;
            if (!res.body || typeof res.body.getReader !== "function") return res.blob();
            var reader = res.body.getReader(), chunks = [], got = 0;
            return (function pump() {
              return reader.read().then(function (r) {
                if (r.done) return new Blob(chunks, { type: "video/mp4" });
                chunks.push(r.value);
                got += r.value.length;
                if (total) {
                  var pct = got / total;
                  if (buffer) buffer.style.width = Math.min(100, pct * 100).toFixed(1) + "%";
                  note("正在缓存完整视频… " + Math.round(pct * 100) + "%", true);
                }
                return pump();
              });
            })();
          })
          .then(function (blob) {
            if (!(blob instanceof Blob)) { caching = false; return; }
            blobUrl = URL.createObjectURL(blob);
            caching = false;
            if (buffer) buffer.style.width = "100%";
            note("已缓存 · 现在可以拖动进度条快进 / 回看", true);
            setTimeout(function () { note("", false); }, 3600);
            if (pendingRatio !== null) applyBlob(pendingRatio);
            else if (video.paused) applyBlob(null);   // 暂停时静默换源，不打断观看
          })
          .catch(function () {
            caching = false;
            note("", false);
          });
      });
    }
    /* 统一的"要跳转到 ratio"入口：能定位就直接跳，否则走缓存流程 */
    function requestSeek(ratio) {
      if (swapped || seekableNow()) { seekTo(ratio); return "ok"; }
      if (blobUrl) { applyBlob(ratio); return "ok"; }
      pendingRatio = ratio;
      paintRatio(ratio);
      if (timeEl && video.duration) timeEl.textContent = fmt(ratio * video.duration) + " / " + fmt(video.duration);
      var wasCaching = caching;
      startCache("user");
      return wasCaching ? "caching" : "started";
    }

    if (cover) {
      cover.addEventListener("click", function () {
        cover.classList.add("hide");
        video.play().catch(function () {});
        wake();
      });
    }
    if (playBtn) playBtn.addEventListener("click", togglePlay);
    video.addEventListener("click", togglePlay);
    video.addEventListener("play", function () {
      if (playBtn) playBtn.textContent = "❚❚";
      wake();
      startCache("auto");   // 服务端不支持 Range 时才后台缓存；超大文件会自动放弃
    });
    video.addEventListener("pause", function () {
      if (playBtn) playBtn.textContent = "▶";
      ui.classList.remove("idle");
      // 已在后台缓存好的视频，趁暂停时静默换源，之后即可任意拖动
      if (blobUrl && !swapped && pendingRatio === null) applyBlob(null);
    });
    video.addEventListener("loadedmetadata", function () {
      if (timeEl) timeEl.textContent = fmt(video.currentTime) + " / " + fmt(video.duration);
    });
    video.addEventListener("timeupdate", function () {
      if (video.duration) paintRatio(video.currentTime / video.duration);
      if (timeEl) timeEl.textContent = fmt(video.currentTime) + " / " + fmt(video.duration);
    });
    if (muteBtn) {
      muteBtn.addEventListener("click", function () {
        video.muted = !video.muted;
        muteBtn.textContent = video.muted ? "🔇" : "🔊";
      });
    }

    /* 进度条交互：点击跳转 + 拖动快进 / 回看（鼠标 · 触摸 · 触控笔） */
    if (progress) {
      var dragging = false;
      progress.setAttribute("role", "slider");
      progress.setAttribute("aria-label", "播放进度");
      progress.tabIndex = 0;

      progress.addEventListener("pointerdown", function (e) {
        dragging = true;
        progress.classList.add("dragging");
        wake();
        try { progress.setPointerCapture(e.pointerId); } catch (err) {}
        if (requestSeek(ratioOf(e.clientX)) !== "ok") {
          toast("视频正在后台缓存，缓存完成后会自动跳到该位置");
        }
        e.preventDefault();
      });
      progress.addEventListener("pointermove", function (e) {
        if (!dragging) return;
        requestSeek(ratioOf(e.clientX));
        e.preventDefault();
      });
      function endDrag() {
        if (!dragging) return;
        dragging = false;
        progress.classList.remove("dragging");
        wake();
      }
      progress.addEventListener("pointerup", endDrag);
      progress.addEventListener("pointercancel", endDrag);
      progress.addEventListener("lostpointercapture", endDrag);
      // 旧浏览器兜底：拖动时阻止页面跟着滚动
      progress.addEventListener("touchmove", function (e) {
        if (dragging) e.preventDefault();
      }, { passive: false });

      // 键盘操作：← 回退 5 秒 / → 前进 5 秒（按住 Shift 为 10 秒）
      progress.addEventListener("keydown", function (e) {
        if (!video.duration || !isFinite(video.duration)) return;
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          var step = e.shiftKey ? 10 : 5;
          var t = video.currentTime + (e.key === "ArrowRight" ? step : -step);
          t = Math.min(Math.max(0, t), video.duration);
          if (requestSeek(t / video.duration) !== "ok") {
            toast("视频正在后台缓存，缓存完成后会自动跳到该位置");
          }
          wake();
          e.preventDefault();
        }
      });
    }

    player.addEventListener("mousemove", wake);
    player.addEventListener("touchstart", wake, { passive: true });
  });

  /* ---------------- Lightbox 大图预览 ---------------- */
  var lb = document.querySelector(".lightbox");
  if (lb) {
    var lbImg = lb.querySelector("img");
    var lbCap = lb.querySelector(".lb-caption");
    document.querySelectorAll("[data-lightbox]").forEach(function (fig) {
      fig.addEventListener("click", function () {
        var img = fig.querySelector("img");
        if (!img || !img.src) return;
        var cap = fig.getAttribute("data-cap") || fig.querySelector(".g-caption");
        lbImg.src = img.src;
        lbCap.textContent = typeof cap === "string" ? cap : (cap ? cap.textContent : "");
        lb.classList.add("open");
        document.body.style.overflow = "hidden";
      });
    });
    function closeLb() {
      lb.classList.remove("open");
      document.body.style.overflow = "";
    }
    lb.addEventListener("click", function (e) {
      if (e.target === lb || e.target.classList.contains("lb-close")) closeLb();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeLb();
    });
  }

  /* ---------------- 计算摄影卡片：点击查看封面大图（暂无独立详情页） ---------------- */
  document.querySelectorAll("[data-zoom]").forEach(function (card) {
    card.addEventListener("click", function () {
      var img = card.querySelector(".work-cover img");
      if (!img || !img.src || !lb || !lbImg) return;
      lbImg.src = img.src;
      lbCap.textContent = card.getAttribute("data-zoom") || "";
      lb.classList.add("open");
      document.body.style.overflow = "hidden";
    });
    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter") card.click();
    });
  });

  /* ---------------- 简历下载（检测文件存在） ---------------- */
  document.querySelectorAll("[data-resume]").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      var url = btn.getAttribute("data-resume");
      fetch(url, { method: "HEAD" })
        .then(function (res) {
          if (res.ok) {
            var a = document.createElement("a");
            a.href = url;
            a.download = "";
            document.body.appendChild(a);
            a.click();
            a.remove();
            toast("简历开始下载");
          } else {
            toast("简历文件待上传：放入 assets/files/ 后即可下载");
          }
        })
        .catch(function () {
          toast("简历文件待上传：放入 assets/files/ 后即可下载");
        });
    });
  });

  /* ---------------- 卡片平滑跳转 ---------------- */
  document.querySelectorAll("[data-link]").forEach(function (card) {
    card.addEventListener("click", function () {
      var url = card.getAttribute("data-link");
      if (!url) return;
      // 轻微缩放反馈后跳转
      card.style.transform = isMobile ? "none" : "scale(0.99)";
      setTimeout(function () { window.location.href = url; }, 160);
    });
    card.addEventListener("keydown", function (e) {
      if (e.key === "Enter") card.click();
    });
  });
})();
