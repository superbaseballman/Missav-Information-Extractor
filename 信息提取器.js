// ==UserScript==
// @name         成人影片信息提取器
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  专门用于提取成人影片网站的元数据信息，包括番号、标题、女优等
// @author       You
// @match        https://missav.live/cn/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 配置区域 - 针对成人影片网站的字段选择器
    const CONFIG = {
        // 发行日期选择器
        releaseDate: 'body > div:nth-child(3) > div.sm\\:container.mx-auto.px-4.content-without-search.pb-12 > div > div.flex-1.order-first > div.sm\\:mx-0.mb-8.rounded-0.sm\\:rounded-lg > div:nth-child(2) > div:nth-child(1) > div > div.space-y-2 > div:nth-child(1) > time',
        // 番号选择器
        code: 'body > div:nth-child(3) > div.sm\\:container.mx-auto.px-4.content-without-search.pb-12 > div > div.flex-1.order-first > div.sm\\:mx-0.mb-8.rounded-0.sm\\:rounded-lg > div:nth-child(2) > div:nth-child(1) > div > div.space-y-2 > div:nth-child(2) > span.font-medium',
        // 标题选择器
        title: 'body > div:nth-child(3) > div.sm\\:container.mx-auto.px-4.content-without-search.pb-12 > div > div.flex-1.order-first > div.sm\\:mx-0.mb-8.rounded-0.sm\\:rounded-lg > div:nth-child(2) > div:nth-child(1) > div > div.space-y-2 > div:nth-child(3) > span.font-medium',
        // 女优选择器
        actresses: 'body > div:nth-child(3) > div.sm\\:container.mx-auto.px-4.content-without-search.pb-12 > div > div.flex-1.order-first > div.sm\\:mx-0.mb-8.rounded-0.sm\\:rounded-lg > div:nth-child(2) > div:nth-child(1) > div > div.space-y-2 > div:nth-child(4) > a',
        // 男优选择器
        actors: '.actor, .actors, .male-actor, .male-performer, [id*="actor"], [class*="actor"], .male-actor a',
        // 类型选择器
        genres: 'body > div:nth-child(3) > div.sm\\:container.mx-auto.px-4.content-without-search.pb-12 > div > div.flex-1.order-first > div.sm\\:mx-0.mb-8.rounded-0.sm\\:rounded-lg > div:nth-child(2) > div:nth-child(1) > div > div.space-y-2 > div:nth-child(5) > a',
        // 系列选择器
        series: 'body > div:nth-child(3) > div.sm\\:container.mx-auto.px-4.content-without-search.pb-12 > div > div.flex-1.order-first > div.sm\\:mx-0.mb-8.rounded-0.sm\\:rounded-lg > div:nth-child(2) > div:nth-child(1) > div > div.space-y-2 > div:nth-child(5) > a',
        // 发行商选择器
        studio: 'body > div:nth-child(3) > div.sm\\:container.mx-auto.px-4.content-without-search.pb-12 > div > div.flex-1.order-first > div.sm\\:mx-0.mb-8.rounded-0.sm\\:rounded-lg > div:nth-child(2) > div:nth-child(1) > div > div.space-y-2 > div:nth-child(6) > a',
        // 导演选择器
        director: 'body > div:nth-child(3) > div.sm\\:container.mx-auto.px-4.content-without-search.pb-12 > div > div.flex-1.order-first > div.sm\\:mx-0.mb-8.rounded-0.sm\\:rounded-lg > div:nth-child(2) > div:nth-child(1) > div > div.space-y-2 > div:nth-child(7) > a',
        // 标签选择器
        tags: 'body > div:nth-child(3) > div.sm\\:container.mx-auto.px-4.content-without-search.pb-12 > div > div.flex-1.order-first > div.sm\\:mx-0.mb-8.rounded-0.sm\\:rounded-lg > div:nth-child(2) > div:nth-child(1) > div > div.space-y-2 > div:nth-child(8) > a',
        // 图片选择器
        image: 'body > div:nth-child(3) > div.sm\\:container.mx-auto.px-4.content-without-search.pb-12 > div > div.flex-1.order-first > div:nth-child(1) > div.relative.-mx-4.sm\\:m-0.-mt-6 > div > div > div.plyr__video-wrapper > div.plyr__poster',
        // 链接选择器
        links: 'a[href]'
    };

    // 存储提取的数据
    let extractedData = {};

    // 创建控制面板
    function createControlPanel() {
        const panel = document.createElement('div');
        panel.setAttribute('style', `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            background-color: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            font-family: Arial, sans-serif;
            min-width: 350px;
            max-width: 500px;
        `);

        // 标题
        const title = document.createElement('h3');
        title.textContent = '成人影片信息提取器';
        title.setAttribute('style', 'margin-top: 0; color: #333;');

        // 配置区域
        const configDiv = document.createElement('div');
        configDiv.setAttribute('style', 'margin: 10px 0;');

        const configTitle = document.createElement('h4');
        configTitle.textContent = '字段选择器配置';
        configTitle.setAttribute('style', 'margin: 0 0 10px 0; color: #333;');

        // 创建选择器输入框
        const selectors = [
            { name: '发行日期', key: 'releaseDate' },
            { name: '番号', key: 'code' },
            { name: '标题', key: 'title' },
            { name: '女优', key: 'actresses' },
            { name: '男优', key: 'actors' },
            { name: '类型', key: 'genres' },
            { name: '系列', key: 'series' },
            { name: '发行商', key: 'studio' },
            { name: '导演', key: 'director' },
            { name: '标签', key: 'tags' },
            { name: '图片', key: 'image' }
        ];

        const inputs = {};
        selectors.forEach(field => {
            const fieldDiv = document.createElement('div');
            fieldDiv.setAttribute('style', 'margin-bottom: 8px;');

            const label = document.createElement('label');
            label.textContent = `${field.name}: `;
            label.setAttribute('style', 'display: inline-block; width: 60px; font-weight: bold;');

            const input = document.createElement('input');
            input.type = 'text';
            input.value = CONFIG[field.key];
            input.setAttribute('style', 'width: calc(100% - 70px); padding: 3px; font-size: 12px;');
            input.addEventListener('change', () => {
                CONFIG[field.key] = input.value;
            });

            fieldDiv.appendChild(label);
            fieldDiv.appendChild(input);
            configDiv.appendChild(fieldDiv);

            inputs[field.key] = input;
        });

        // 按钮区域
        const buttonDiv = document.createElement('div');
        buttonDiv.setAttribute('style', 'margin: 10px 0; display: flex; flex-wrap: wrap; gap: 5px;');

        const extractBtn = document.createElement('button');
        extractBtn.textContent = '提取字段';
        extractBtn.setAttribute('style', `
            flex: 1;
            background-color: #4CAF50;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            min-width: 100px;
        `);
        extractBtn.addEventListener('click', extractFields);

        const exportBtn = document.createElement('button');
        exportBtn.textContent = '导出JSON';
        exportBtn.setAttribute('style', `
            flex: 1;
            background-color: #2196F3;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            min-width: 100px;
        `);
        exportBtn.addEventListener('click', exportAsJson);

        const copyBtn = document.createElement('button');
        copyBtn.textContent = '复制结果';
        copyBtn.setAttribute('style', `
            flex: 1;
            background-color: #FF9800;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            min-width: 100px;
        `);
        copyBtn.addEventListener('click', copyResults);

        buttonDiv.appendChild(extractBtn);
        buttonDiv.appendChild(exportBtn);
        buttonDiv.appendChild(copyBtn);

        // 结果显示区域
        const resultDiv = document.createElement('div');
        resultDiv.setAttribute('style', `
            margin-top: 15px;
            max-height: 300px;
            overflow: auto;
            border: 1px solid #ddd;
            padding: 10px;
            background-color: #f9f9f9;
            font-size: 12px;
        `);
        resultDiv.id = 'extractionResults';

        // 组装控制面板
        panel.appendChild(title);
        panel.appendChild(configDiv);
        panel.appendChild(buttonDiv);
        panel.appendChild(resultDiv);

        document.body.appendChild(panel);
    }

    // 提取字段内容
    function extractFields() {
        extractedData = {
            发行日期: extractText(CONFIG.releaseDate),
            番号: extractText(CONFIG.code),
            标题: extractText(CONFIG.title),
            女优: extractMultipleText(CONFIG.actresses),
            男优: extractMultipleText(CONFIG.actors),
            类型: extractMultipleText(CONFIG.genres),
            系列: extractText(CONFIG.series),
            发行商: extractText(CONFIG.studio),
            导演: extractText(CONFIG.director),
            标籤: extractMultipleText(CONFIG.tags),
            原始URL: window.location.href,
            图片URL: extractImages(CONFIG.image),
            timestamp: new Date().toISOString()
        };

        displayResults(extractedData);
    }

    // 提取文本内容
    function extractText(selector) {
        try {
            const elements = document.querySelectorAll(selector);
            if (elements.length === 0) return '';

            // 合并所有匹配元素的文本内容
            return Array.from(elements)
                .map(el => el.textContent.trim())
                .filter(text => text)
                .join(' | ');
        } catch (e) {
            console.error(`选择器错误: ${selector}`, e);
            return '';
        }
    }

    // 提取多个文本项（如女优列表）
    function extractMultipleText(selector) {
        try {
            const elements = document.querySelectorAll(selector);
            if (elements.length === 0) return [];

            // 获取所有匹配元素的文本内容
            return Array.from(elements)
                .map(el => el.textContent.trim())
                .filter(text => text && text.length > 0);
        } catch (e) {
            console.error(`选择器错误: ${selector}`, e);
            return [];
        }
    }

    // 提取图片链接
    function extractImages(selector) {
        try {
            const elements = document.querySelectorAll(selector);
            return Array.from(elements)
                .map(el => {
                    // 尝试获取src属性
                    let src = el.src || el.getAttribute('src');
                    // 如果没有src，尝试data-src等懒加载属性
                    if (!src) src = el.getAttribute('data-src') || el.getAttribute('data-original');
                    return src;
                })
                .filter(src => src)
                .map(src => new URL(src, window.location).href); // 转换为绝对路径
        } catch (e) {
            console.error(`图片选择器错误: ${selector}`, e);
            return [];
        }
    }

    // 提取链接
    function extractLinks(selector) {
        try {
            const elements = document.querySelectorAll(selector);
            return Array.from(elements)
                .map(el => {
                    const href = el.href;
                    const text = el.textContent.trim();
                    return href && href !== '#' && !href.startsWith('javascript:') ? { url: href, text } : null;
                })
                .filter(link => link);
        } catch (e) {
            console.error(`链接选择器错误: ${selector}`, e);
            return [];
        }
    }

    // 显示结果
    function displayResults(data) {
        const resultDiv = document.getElementById('extractionResults');
        if (!resultDiv) return;

        // 清空之前的结果
        resultDiv.innerHTML = '';

        // 创建结果展示
        const resultTitle = document.createElement('h4');
        resultTitle.textContent = '提取结果';
        resultTitle.setAttribute('style', 'margin-top: 0; color: #333;');
        resultDiv.appendChild(resultTitle);

        // 显示基本信息
        const basicInfo = document.createElement('div');
        basicInfo.innerHTML = `
            <p><strong>原始URL:</strong> ${data.原始URL}</p>
            <p><strong>时间戳:</strong> ${data.timestamp}</p>
            <p><strong>标题:</strong> ${data.标题 || '未找到'}</p>
            <p><strong>番号:</strong> ${data.番号 || '未找到'}</p>
            <p><strong>发行日期:</strong> ${data.发行日期 || '未找到'}</p>
            <p><strong>系列:</strong> ${data.系列 || '未找到'}</p>
            <p><strong>发行商:</strong> ${data.发行商 || '未找到'}</p>
            <p><strong>导演:</strong> ${data.导演 || '未找到'}</p>
        `;
        resultDiv.appendChild(basicInfo);

        // 显示女优
        if (data.女优.length > 0) {
            const actressDiv = document.createElement('div');
            actressDiv.innerHTML = `<p><strong>女优:</strong> ${data.女优.join(', ')}</p>`;
            resultDiv.appendChild(actressDiv);
        }

        // 显示男优
        if (data.男优.length > 0) {
            const actorDiv = document.createElement('div');
            actorDiv.innerHTML = `<p><strong>男优:</strong> ${data.男优.join(', ')}</p>`;
            resultDiv.appendChild(actorDiv);
        }

        // 显示类型
        if (data.类型.length > 0) {
            const genreDiv = document.createElement('div');
            genreDiv.innerHTML = `<p><strong>类型:</strong> ${data.类型.join(', ')}</p>`;
            resultDiv.appendChild(genreDiv);
        }

        // 显示标签
        if (data.标籤.length > 0) {
            const tagDiv = document.createElement('div');
            tagDiv.innerHTML = `<p><strong>标签:</strong> ${data.标籤.join(', ')}</p>`;
            resultDiv.appendChild(tagDiv);
        }

        // 显示图片
        if (data.图片URL.length > 0) {
            const imagesDiv = document.createElement('div');
            imagesDiv.innerHTML = '<p><strong>图片:</strong></p>';
            data.图片URL.forEach(img => {
                const imgContainer = document.createElement('div');
                imgContainer.innerHTML = `
                    <div style="margin: 5px 0;">
                        <a href="${img}" target="_blank">
                            <img src="${img}" style="max-width: 100px; max-height: 100px; margin-right: 5px; border: 1px solid #ccc;" alt="提取的图片">
                        </a>
                        <small>${img.length > 50 ? img.substring(0, 50) + '...' : img}</small>
                    </div>
                `;
                imagesDiv.appendChild(imgContainer);
            });
            resultDiv.appendChild(imagesDiv);
        }
    }

    // 导出为JSON
    function exportAsJson() {
        if (!extractedData || Object.keys(extractedData).length === 0) {
            alert('请先提取字段');
            return;
        }

        const jsonData = JSON.stringify(extractedData, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `extracted_data_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // 复制结果到剪贴板
    function copyResults() {
        if (!extractedData || Object.keys(extractedData).length === 0) {
            alert('请先提取字段');
            return;
        }

        navigator.clipboard.writeText(JSON.stringify(extractedData, null, 2))
            .then(() => {
                alert('结果已复制到剪贴板');
            })
            .catch(err => {
                console.error('复制失败: ', err);
                // 降级处理：使用旧方法复制
                const textArea = document.createElement('textarea');
                textArea.value = JSON.stringify(extractedData, null, 2);
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                alert('结果已复制到剪贴板');
            });
    }

    // 初始化脚本
    function init() {
        createControlPanel();
    }

    // 页面加载完成后初始化
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }
})();