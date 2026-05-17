/**
 * ============================================================
 * 京东领券助手 - 服务器版 (jd-coupon.js)
 * ============================================================
 *
 * 部署到你自己的服务器上，通过 Stream/Quantumult X/Surge 等
 * 抓包工具注入一行 <script> 标签即可使用。
 * 更新此文件后所有设备自动生效，无需重新配置。
 *
 * 【注入代码】（放到抓包工具的JS重写规则里）
 * 在 </head> 之前插入：
 *   <script src="https://你的服务器/jd-coupon.js"></script>
 *
 * 【支持场次】
 * - 12:00 场（3张券）
 * - 18:00 场（2张券）
 * - 当前可领（6张券）
 *
 * 【功能】
 * - 隐藏"已抢光""开抢"状态戳
 * - 所有券始终显示可点击
 * - 顶部倒计时状态栏（红色=等待，绿色=可领）
 * - 到时间前点击 → 静默拦截
 * - 到时间后点击 → 正常领券
 * - 自动点击模式（可配置）
 */

(function() {
    'use strict';

    if (document.getElementById('_jdcs_bar')) return;

    // ==================== 配置 ====================
    var CONFIG = {
        autoClick: false,       // 是否到点自动点击领取
        autoClickDelay: 800,    // 自动点击延迟(ms)
        showStatusBar: true,    // 显示顶部状态栏
        fallbackRefresh: false, // 点击失败是否刷新
        graceMs: 3000,          // 提前放行窗口（11:59:57即可点击）
    };

    // ==================== 状态栏 ====================
    var bar = document.createElement('div');
    bar.id = '_jdcs_bar';
    bar.style.cssText = [
        'position:fixed;top:0;left:0;right:0;z-index:99999;',
        'background:linear-gradient(135deg,#e73c3c,#f55555);color:#fff;',
        'text-align:center;padding:6px 12px;font-size:13px;font-weight:600;',
        'box-shadow:0 2px 8px rgba(231,60,60,.3);',
        'font-family:PingFang SC,sans-serif;',
        'display:flex;align-items:center;justify-content:center;gap:6px;'
    ].join('');
    document.body.insertBefore(bar, document.body.firstChild);
    document.body.style.paddingTop = '40px';

    // ==================== 工具函数 ====================
    function fmt(ms) {
        if (ms <= 0) return '00:00:00';
        var s = Math.floor(ms / 1000);
        return p(Math.floor(s/3600)) + ':' +
               p(Math.floor(s%3600/60)) + ':' + p(s%60);
    }
    function p(n) { return n < 10 ? '0'+n : ''+n; }

    function getTimeSlots() {
        var now = new Date();
        var noon = new Date(now); noon.setHours(12, 0, 0, 0);
        var eve  = new Date(now); eve.setHours(18, 0, 0, 0);
        return {
            d12: noon - now,   // >0 = 还没到12:00
            d18: eve - now,    // >0 = 还没到18:00
            h: now.getHours(),
            m: now.getMinutes(),
            s: now.getSeconds()
        };
    }

    /**
     * 判断当前是否在某个场次的等待期
     * 返回 { canClaim: boolean, nextSlot: '12:00'|'18:00'|null }
     */
    function getClaimStatus() {
        var t = getTimeSlots();
        if (t.d12 > 0) {
            return { canClaim: false, nextSlot: '12:00', countdown: t.d12 };
        }
        if (t.d12 <= 0 && t.d18 > 0) {
            // 12:00已过，18:00还没到 → 12:00的券可领，18:00的等
            return { canClaim: true, nextSlot: '18:00', countdown: t.d18, pastNoon: true };
        }
        // 18:00也过了 → 全部可领
        return { canClaim: true, nextSlot: null, countdown: 0 };
    }

    // ==================== DOM 修改 ====================
    function hideStamps() {
        var ss = document.querySelectorAll('.coupon_status_stamp');
        for (var i = 0; i < ss.length; i++) {
            var el = ss[i];
            el.style.setProperty('display', 'none', 'important');
            el.style.setProperty('visibility', 'hidden', 'important');
            el.style.setProperty('opacity', '0', 'important');
            el.style.setProperty('pointer-events', 'none', 'important');
        }
    }

    function enableButtons() {
        var bs = document.querySelectorAll('.button_no_click');
        for (var i = 0; i < bs.length; i++) {
            var el = bs[i];
            el.classList.remove('button_no_click');
            el.classList.add('button_can_click');
            if (!el.classList.contains('can_get')) {
                el.classList.add('can_get');
            }
            el.style.opacity = '1';
            el.style.pointerEvents = 'auto';
            el.style.cursor = 'pointer';
            el.classList.remove('hour_coupon_empty_in_this_time');
            el.classList.remove('hour_coupon_not_in_accept_time');
        }
    }

    // ==================== 状态栏更新 ====================
    function updateBar() {
        var st = getClaimStatus();
        if (!st.canClaim && st.nextSlot) {
            bar.innerHTML =
                '<span>距' + st.nextSlot + '</span>' +
                '<span style="font-family:monospace;font-size:16px;' +
                'background:rgba(255,255,255,.2);padding:2px 8px;border-radius:4px;">' +
                fmt(st.countdown) + '</span>';
            bar.style.background = 'linear-gradient(135deg,#e73c3c,#f55555)';
        } else if (st.canClaim && st.nextSlot) {
            bar.innerHTML =
                '<span>✅ 12:00场可领 | 距18:00</span>' +
                '<span style="font-family:monospace;font-size:16px;' +
                'background:rgba(255,255,255,.2);padding:2px 8px;border-radius:4px;">' +
                fmt(st.countdown) + '</span>';
            bar.style.background = 'linear-gradient(135deg,#f59e0b,#d97706)';
        } else {
            bar.innerHTML = '<span>✅ 全部场次可领取！点击领券</span>';
            bar.style.background = 'linear-gradient(135deg,#1aa34a,#22c55e)';
        }
    }

    // ==================== 点击拦截（静默，无弹窗） ====================
    // 判断逻辑：某个场次的券，没到该场次时间就拦截
    // - 12:00前：所有时间券都拦截
    // - 12:00-18:00：12:00券放行，18:00券拦截
    // - 18:00后：全部放行
    function shouldBlockClick() {
        var t = getTimeSlots();
        // 12:00还没到 → 全部拦截
        if (t.d12 > 0) return true;
        // 12:00过了，但18:00还没到 → 18:00的券拦截
        // 注意：这里没法区分用户点的是12:00券还是18:00券
        // 策略：12:00-18:00之间放行（因为12:00券可领了）
        //      18:00券虽然也能点，但服务器会拒绝，用户自己承担
        if (t.d18 > 0 && t.h >= 12) return false; // 全部放行
        // 18:00后
        return false;
    }

    function guard() {
        // 提前放行，避免手机与服务器时钟偏差
        var batchBtn = document.querySelector('.batch_receive_btn');
        if (batchBtn && !batchBtn._g) {
            batchBtn._g = true;
            batchBtn.addEventListener('click', function(e) {
                if (getTimeSlots().d12 > CONFIG.graceMs) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    return false;
                }
            }, true);
        }

        var cps = document.querySelectorAll('.coupon');
        for (var i = 0; i < cps.length; i++) {
            if (cps[i]._g) continue;
            cps[i]._g = true;
            cps[i].addEventListener('click', function(e) {
                if (getTimeSlots().d12 > CONFIG.graceMs) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    return false;
                }
            }, true);
        }
    }

    // ==================== 自动点击 ====================
    var autoClicked = {};

    function checkAutoClick() {
        if (!CONFIG.autoClick) return;
        var t = getTimeSlots();
        var now = Date.now();

        // 12:00 前后 graceMs 都触发（提前量应对时钟偏差）
        if (!autoClicked['12'] && t.d12 <= CONFIG.graceMs && t.d12 > -3000) {
            autoClicked['12'] = true;
            bar.innerHTML = '<span>🎉 12:00已到！自动领取...</span>';
            bar.style.background = 'linear-gradient(135deg,#1aa34a,#22c55e)';
            setTimeout(tryClick, CONFIG.autoClickDelay);
        }
        // 18:00 前后3秒都触发
        if (!autoClicked['18'] && t.d18 <= CONFIG.graceMs && t.d18 > -3000) {
            autoClicked['18'] = true;
            bar.innerHTML = '<span>🎉 18:00已到！自动领取...</span>';
            bar.style.background = 'linear-gradient(135deg,#1aa34a,#22c55e)';
            setTimeout(tryClick, CONFIG.autoClickDelay);
        }
    }

    function tryClick() {
        var btn = document.querySelector('.batch_receive_btn');
        if (btn) {
            console.log('[领券助手] 🎯 自动点击一键领取');
            btn.click();
        } else if (CONFIG.fallbackRefresh) {
            location.reload();
        }
    }

    // ==================== MutationObserver ====================
    function startObserver() {
        try {
            var ob = new MutationObserver(function() {
                hideStamps();
                enableButtons();
                guard();
            });
            ob.observe(document.documentElement, { childList: true, subtree: true });
        } catch(e) {}
    }

    // ==================== 主循环 ====================
    function init() {
        hideStamps();
        enableButtons();
        updateBar();
        guard();
        startObserver();

        setInterval(function() {
            updateBar();
            checkAutoClick();
            hideStamps();
            enableButtons();
            guard();
        }, 500);

        console.log('[领券助手] ✅ 已启动 (服务器版)');
        console.log('[领券助手]   12:00场 + 18:00场 自动支持');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
