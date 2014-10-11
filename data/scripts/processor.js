log('processor.js');

function Processor(pref) {
  var queue = [], timeout = null, observer = null;

  function run(rubies) {
    log('processor.run()');
    var count = rubies.length, range, parent, fragment;
    if (count > 50) {
      range = document.createRange();
      range.setStartBefore(rubies[0]);
      range.setEndAfter(rubies[count-1]);
      parent = range.commonAncestorContainer;
      range.selectNodeContents(parent);
      fragment = range.extractContents();
    }
    process(rubies);
    if (typeof fragment !== 'undefined') {
      parent.appendChild(fragment);
    }
  }
  function process(block) {
    log('processor.process()');

    var count = block.length,
      toQueue,
      spaceRubyText = pref.spaceRubyText,
      i, j, range, ruby, rbs, rbCount, rtc, rbc, rts, rtCount, rt, rb, rtcs;
    if (spaceRubyText) {
      toQueue = new Array(count);
    }
    for (i=count; i--; ) {
      ruby = block[i];
      if (!ruby) {
        continue;
      }
      if (ruby.hasAttribute('htmlruby_processed')) {
        continue;
      }
      ruby.setAttribute('htmlruby_processed', 'processed', null);
      if (ruby.querySelector('rbc')) {
        rtcs = ruby.querySelectorAll('rtc'); 
        if (rtcs.length === 2) {
          ruby.setAttribute('title', rtcs[1].textContent.trim());
        }
        if (spaceRubyText) {
          queue[i] = new RubyData(ruby);
        }
      } else {
        rbs = ruby.querySelectorAll('rb');
        rbCount = rbs.length;
        rtc = document.createElement('rtc');
        rbc = document.createElement('rbc');
        rts = ruby.querySelectorAll('rt');
        rtCount = rts.length;
        if (rbCount > 0) {
          for (j=0; j<rbCount; j++) {
            rbc.appendChild(rbs[j]);
          }
          for (j=0; j<rtCount; j++) {
            rtc.appendChild(rts[j]);
          }
        } else {
          if (!rtCount) {
            continue;
          }
          ruby.normalize();
          for (j=rtCount; j--; ) {
            rt = rts[j];
            rb = document.createElement('rb');
            range = document.createRange();
            if (j > 0) {
              range.setStartAfter(rts[j-1]);
            } else {
              range.setStart(ruby, 0);
            }
            range.setEndBefore(rt);
            rb.appendChild(range.extractContents());
            rbc.insertBefore(rb, rbc.firstChild);
            rtc.insertBefore(rt, rtc.firstChild);
          }
        }
        ruby.appendChild(rbc);
        ruby.appendChild(rtc);
        if (spaceRubyText) {
          toQueue[i] = new RubyData(ruby);
        }
      }
    }
    if (spaceRubyText) {
      queue = queue.concat(toQueue);
    }
  }
  function space() {
    log('processor.space()');

    onPause();

    function apply(elem, diff, maxWidth) {
      var text = elem.textContent.trim(),
        len = text.length,
        wordCount, perChar;
      if (!len) {
        return;
      }
      if (text.charCodeAt(0) <= 128) {
        wordCount = text.split(' ').length;
        if (wordCount > 1) {
          elem.style.cssText += ';max-width:' + maxWidth + 'px;word-spacing:' + Math.round(diff/wordCount) + 'px;';
        }
      } else {
        perChar = diff / len;
        if (perChar) {
          elem.style.cssText += ';max-width:' + maxWidth + 'px;text-indent:' + Math.round(perChar/2) + 'px;letter-spacing:' + Math.round(perChar) + 'px;';
        }
      }
    }

    log('start spacing');

    var block = queue.splice(0, 250),
      count = block.length,
      i = count, j, data,
      rbWidths, rtWidths, rbs, rts, rbCount, rb, rt, rbWidth, rtWidth, diff;
    for (; i--; ) {
      data = block[i];
      if (data) {
        data.calculateWidths();
      }
    }
    for (i=count; i--; ) {
      data = block[i];
      if (!data) {
        continue;
      }
      rbWidths = data.rbWidths;
      rtWidths = data.rtWidths;
      rbs = data.rbs;
      rts = data.rts;
      rbCount = rbs.length;
      for (j=rbCount; j--; ) {
        rb = rbs[j];
        rt = rts[j];
        rbWidth = rbWidths[j];
        rtWidth = rtWidths[j];
        diff = rbWidth - rtWidth;
        if (rtWidth === undefined) {
          rbWidths[j-1] += rbWidth;
          continue;
        }
        if (rbWidth === 0) {
          rb.style.cssText = ';min-width:' + rtWidth + 'px;min-height:1px;';
          continue;
        }
        if (rtWidth === 0) {
          rt.style.cssText = ';min-width:' + rbWidth + 'px;min-height:1px;';
          continue;
        }
        if (diff > 0) {
          apply(rt, diff, rbWidth);
        } else {
          apply(rb, Math.abs(diff), rtWidth);
        }
      }
    }

    log('stop spacing');

    onResume();
  }
  function flush() {
    log('processor.flush()');

    var rubies = document.body.querySelectorAll('ruby:not([htmlruby_processed])'),
      count = rubies.length;
    if (count > 0) {
      onPause();
      run(rubies);
      onResume(); 
    }
  }
  function onResume() {
    log('processor.onResume()');

    function checkNode(node) {
      return node.nodeType === Node.ELEMENT_NODE && (node.nodeName.toLowerCase() === 'ruby' || node.querySelector('ruby'));
    }
    function checkMutation(mutation) {
      var i = 0, max = mutation.addedNodes.length, node;
      for (; i<max; i++) {
        node = mutation.addedNodes[i];
        if (checkNode(node)) {
          log('observer found inserted ruby');
          return true;
        }
      }
      return false;
    }
    function onMutations(mutations) {
      var i = 0, max = mutations.length, mutation;
      for (; i<max; i++) {
        mutation = mutations[i];
        if (mutation.type === 'childList' && mutation.addedNodes && checkMutation(mutation)) {
          flush();
          break;
        }
      }
    }

    if (pref.processInsertedContent) {
      if (observer === null) {
        observer = new MutationObserver(onMutations);
      }
      observer.observe(document.body, {
        childList: true,
        attributes: false,
        characterData: false,
        subtree: true
      });
    }
    if (pref.spaceRubyText && queue.length > 0) {
      timeout = window.setTimeout(space, 100);
    }
  }
  function onPause() {
    log('processor.onPause()');

    clearTimeout(timeout);
    if (observer !== null) {
      observer.disconnect();
    }
  }
  function onAbort() {
    log('processor.onAbort');

    onPause();
    queue = [];
    onResume();
  }

  this.pause = onPause;
  this.resume = onResume;
  this.abort = onAbort;
  this.start = flush;
}