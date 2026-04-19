/* DH AI Chat Widget - with cross-page persistence */
(function () {
  'use strict';

  const cfg = window.dhChatConfig || {};
  const brand = cfg.brandColor || '#0D9488';
  const CTA_URL = 'https://www.deepakhasija.com/book-a-free-call/';
  const STORAGE_KEY = 'dh_chat_messages';
  const OPEN_KEY    = 'dh_chat_open';

  document.addEventListener('DOMContentLoaded', function () {
    const root = document.getElementById('dh-chat-root');
    if (root) root.style.setProperty('--dh-brand', brand);
    init();
  });

  var messages = [];
  var isTyping = false;

  /* ── Session storage helpers ── */
  function saveMessages() {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch(e) {}
  }

  function loadMessages() {
    try {
      var stored = sessionStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch(e) { return []; }
  }

  function saveOpenState(open) {
    try { sessionStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch(e) {}
  }

  function loadOpenState() {
    try { return sessionStorage.getItem(OPEN_KEY) === '1'; } catch(e) { return false; }
  }

  /* ── Init ── */
  function init() {
    var root = document.getElementById('dh-chat-root');
    if (!root) return;

    root.innerHTML = buildPill() + buildWindow();

    document.getElementById('dh-chat-pill').addEventListener('click', toggleChat);
    document.getElementById('dh-close-btn').addEventListener('click', function (e) { e.stopPropagation(); toggleChat(); });
    document.getElementById('dh-send-btn').addEventListener('click', sendMessage);
    document.getElementById('dh-textarea').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    document.getElementById('dh-textarea').addEventListener('input', function () {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    });

    // Restore previous session
    messages = loadMessages();

    if (messages.length > 0) {
      // Replay stored messages into the UI
      restoreMessages();
    } else {
      // Fresh session — show greeting
      var greeting = cfg.greeting || "Hi! How can I help you today?";
      messages.push({ role: 'assistant', content: greeting, _greeting: true });
      saveMessages();
      renderBotBubble(greeting, true);
    }

    // Restore open/closed state
    if (loadOpenState()) {
      openChat();
    }
  }

  /* ── Restore all messages from sessionStorage ── */
  function restoreMessages() {
    var container = document.getElementById('dh-messages');
    messages.forEach(function (msg, idx) {
      var el = document.createElement('div');
      if (msg.role === 'user') {
        el.className = 'dh-msg dh-msg-user';
        el.innerHTML = '<div class="dh-bubble">' + escHtml(msg.content) + '</div>'
          + '<div class="dh-msg-time">' + (msg._time || '') + '</div>';
      } else {
        el.className = 'dh-msg dh-msg-bot';
        el.innerHTML = '<div class="dh-bubble dh-markdown">' + renderMarkdown(msg.content) + '</div>'
          + '<div class="dh-msg-time">' + (msg._time || '') + '</div>';
        // Only show quick replies after the very first greeting if it's the last message
        if (msg._greeting && idx === messages.length - 1) {
          container.appendChild(el);
          appendQuickReplies(container);
          return;
        }
      }
      container.appendChild(el);
    });
    scrollToBottom();
  }

  /* ── Build HTML ── */
  function buildPill() {
    var logoHtml = cfg.logoUrl
      ? '<img src="' + escAttr(cfg.logoUrl) + '" alt="Logo" />'
      : '<span class="dh-pill-logo-initials">' + getInitials(cfg.agentName || 'DH') + '</span>';
    return '<button id="dh-chat-pill" aria-label="Open chat">'
      + '<div class="dh-pill-logo">' + logoHtml + '</div>'
      + '<div class="dh-pill-divider"></div>'
      + '<div class="dh-pill-content">'
      + '<svg class="dh-pill-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2 5a2 2 0 012-2h16a2 2 0 012 2v10a2 2 0 01-2 2H8l-4 4V17H4a2 2 0 01-2-2V5z"/></svg>'
      + '<span class="dh-pill-label">' + escHtml(cfg.pillLabel || ('Chat with ' + (cfg.agentName || 'Deepak') + "'s AI")) + '</span>'
      + '</div><div class="dh-pill-dot"></div></button>';
  }

  function buildWindow() {
    var avatarHtml = (cfg.agentAvatar && cfg.agentAvatar.indexOf('placeholder') === -1)
      ? '<img src="' + escAttr(cfg.agentAvatar) + '" alt="' + escAttr(cfg.agentName) + '" />'
      : '<div class="dh-avatar-initials">' + getInitials(cfg.agentName || 'DH') + '</div>';
    return '<div id="dh-chat-window" class="dh-hidden" role="dialog">'
      + '<div class="dh-chat-header">'
      + '<div class="dh-header-avatar">' + avatarHtml + '<div class="dh-status-dot"></div></div>'
      + '<div class="dh-header-info">'
      + '<div class="dh-header-name">' + escHtml(cfg.agentName || 'Deepak') + "'s AI</div>"
      + '<div class="dh-header-title">' + escHtml(cfg.agentTitle || 'WordPress & AI Expert') + '</div>'
      + '</div>'
      + '<div class="dh-header-badge">AI Powered</div>'
      + '<button class="dh-close-btn" id="dh-close-btn" aria-label="Close">'
      + '<svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>'
      + '</button></div>'
      + '<div class="dh-messages" id="dh-messages"></div>'
      + '<div class="dh-cta-strip">'
      + '<div class="dh-cta-text">Ready to discuss your project?</div>'
      + '<a href="' + CTA_URL + '" target="_blank" class="dh-cta-btn">Book a Free Call</a>'
      + '</div>'
      + '<div class="dh-input-area">'
      + '<div class="dh-input-row">'
      + '<textarea id="dh-textarea" class="dh-textarea" placeholder="Ask me anything..." rows="1" maxlength="800" aria-label="Type your message"></textarea>'
      + '<button id="dh-send-btn" class="dh-send-btn" aria-label="Send">'
      + '<svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/></svg>'
      + '</button></div>'
      + '<div class="dh-powered">Powered by Claude AI &middot; <a href="https://deepakhasija.com" target="_blank">deepakhasija.com</a></div>'
      + '</div></div>';
  }

  /* ── Open / Close ── */
  function openChat() {
    var win = document.getElementById('dh-chat-window');
    var pill = document.getElementById('dh-chat-pill');
    win.classList.remove('dh-hidden');
    pill.style.opacity = '0.7';
    saveOpenState(true);
    setTimeout(function () { document.getElementById('dh-textarea').focus(); scrollToBottom(); }, 100);
  }

  function closeChat() {
    var win = document.getElementById('dh-chat-window');
    var pill = document.getElementById('dh-chat-pill');
    win.classList.add('dh-hidden');
    pill.style.opacity = '1';
    saveOpenState(false);
  }

  function toggleChat() {
    var win = document.getElementById('dh-chat-window');
    if (win.classList.contains('dh-hidden')) { openChat(); } else { closeChat(); }
  }

  /* ── Send message ── */
  function sendMessage() {
    var textarea = document.getElementById('dh-textarea');
    var text = textarea.value.trim();
    if (!text || isTyping) return;

    // Add to UI + storage
    var time = getTime();
    messages.push({ role: 'user', content: text, _time: time });
    saveMessages();
    renderUserBubble(text, time);

    textarea.value = '';
    textarea.style.height = 'auto';
    var qr = document.getElementById('dh-quick-replies');
    if (qr) qr.remove();

    showTyping();

    var formData = new FormData();
    formData.append('action', 'dh_chat_message');
    formData.append('nonce', cfg.nonce);
    // Send only role+content to the API (strip our private _time/_greeting fields)
    var apiMessages = messages.map(function(m) { return { role: m.role, content: m.content }; });
    formData.append('messages', JSON.stringify(apiMessages));

    fetch(cfg.ajaxUrl, { method: 'POST', body: formData })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        hideTyping();
        if (data.success && data.data && data.data.reply) {
          var reply = data.data.reply;
          var rtime = getTime();
          messages.push({ role: 'assistant', content: reply, _time: rtime });
          saveMessages();
          renderBotBubble(reply, false, rtime);
        } else {
          renderBotBubble('Sorry, something went wrong. <a href="' + CTA_URL + '" target="_blank">Book a call directly</a>.', false);
        }
      })
      .catch(function () {
        hideTyping();
        renderBotBubble('Connection error. <a href="' + CTA_URL + '" target="_blank">Reach out directly here</a>.', false);
      });
  }

  /* ── Render helpers ── */
  function renderUserBubble(text, time) {
    var container = document.getElementById('dh-messages');
    var el = document.createElement('div');
    el.className = 'dh-msg dh-msg-user';
    el.innerHTML = '<div class="dh-bubble">' + escHtml(text) + '</div>'
      + '<div class="dh-msg-time">' + (time || getTime()) + '</div>';
    container.appendChild(el);
    scrollToBottom();
  }

  function renderBotBubble(text, withQuickReplies, time) {
    var container = document.getElementById('dh-messages');
    var el = document.createElement('div');
    el.className = 'dh-msg dh-msg-bot';
    el.innerHTML = '<div class="dh-bubble dh-markdown">' + renderMarkdown(text) + '</div>'
      + '<div class="dh-msg-time">' + (time || getTime()) + '</div>';
    container.appendChild(el);
    if (withQuickReplies) appendQuickReplies(container);
    scrollToBottom();
  }

  function appendQuickReplies(container) {
    var qr = document.createElement('div');
    qr.className = 'dh-quick-replies';
    qr.id = 'dh-quick-replies';
    ['WordPress help', 'AI integration', 'WooCommerce', 'Book a call'].forEach(function (r) {
      var btn = document.createElement('button');
      btn.className = 'dh-quick-reply';
      btn.textContent = r;
      btn.addEventListener('click', function () {
        document.getElementById('dh-textarea').value = r;
        sendMessage();
      });
      qr.appendChild(btn);
    });
    container.appendChild(qr);
  }

  /* ── Typing indicator ── */
  function showTyping() {
    isTyping = true;
    document.getElementById('dh-send-btn').disabled = true;
    var container = document.getElementById('dh-messages');
    var el = document.createElement('div');
    el.className = 'dh-msg dh-msg-bot';
    el.id = 'dh-typing-indicator';
    el.innerHTML = '<div class="dh-typing"><span></span><span></span><span></span></div>';
    container.appendChild(el);
    scrollToBottom();
  }

  function hideTyping() {
    isTyping = false;
    document.getElementById('dh-send-btn').disabled = false;
    var el = document.getElementById('dh-typing-indicator');
    if (el) el.remove();
  }

  /* ── Markdown renderer ── */
  function renderMarkdown(raw) {
    if (!raw) return '';
    var hasHtml = /<a\s/i.test(raw);
    var lines = raw.split('\n');
    var output = [];
    var inUl = false, inOl = false;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/^[\-\*\+] /.test(line)) {
        if (!inUl) { output.push('<ul>'); inUl = true; }
        if (inOl)  { output.push('</ol>'); inOl = false; }
        output.push('<li>' + inlineFormat(line.replace(/^[\-\*\+] /, ''), hasHtml) + '</li>');
        continue;
      }
      if (/^\d+\. /.test(line)) {
        if (!inOl) { output.push('<ol>'); inOl = true; }
        if (inUl)  { output.push('</ul>'); inUl = false; }
        output.push('<li>' + inlineFormat(line.replace(/^\d+\. /, ''), hasHtml) + '</li>');
        continue;
      }
      if (inUl) { output.push('</ul>'); inUl = false; }
      if (inOl) { output.push('</ol>'); inOl = false; }
      if (/^#{1,3} /.test(line)) { output.push('<p><strong>' + inlineFormat(line.replace(/^#{1,3} /, ''), hasHtml) + '</strong></p>'); continue; }
      if (/^---+$/.test(line.trim())) { output.push('<hr>'); continue; }
      if (/^> /.test(line)) { output.push('<blockquote>' + inlineFormat(line.replace(/^> /, ''), hasHtml) + '</blockquote>'); continue; }
      if (line.trim() === '') { output.push('<br>'); continue; }
      output.push('<p>' + inlineFormat(line, hasHtml) + '</p>');
    }
    if (inUl) output.push('</ul>');
    if (inOl) output.push('</ol>');
    return output.join('');
  }

  function inlineFormat(text, allowHtml) {
    if (!allowHtml) {
      text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.+?)__/g, '<strong>$1</strong>');
    text = text.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
    text = text.replace(/_([^_\n]+?)_/g, '<em>$1</em>');
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    text = text.replace(/((?<!=["'])(https?:\/\/[^\s<]+))/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    return text;
  }

  /* ── Utilities ── */
  function scrollToBottom() {
    var c = document.getElementById('dh-messages');
    if (c) c.scrollTop = c.scrollHeight;
  }

  function getTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function getInitials(name) {
    return (name || 'DH').split(' ').map(function (w) { return w[0]; }).join('').toUpperCase().slice(0, 2);
  }

  function escHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escAttr(str) {
    return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
})();
