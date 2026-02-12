// ==UserScript==
// @name         成人影片信息提取器
// @namespace    http://tampermonkey.net/
// @version      1.8
// @description  专门用于提取成人影片网站的元数据信息，支持智能识别、面板隐藏显示和移动端适配
// @author       You
// @match        https://missav.live/cn/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 配置区域 - 智能关键词匹配配置
    const CONFIG = {
        // 智能提取配置
        smartExtract: {
            // 关键词映射：span中文本 -> 对应的字段名
            keywordMapping: {
                '番号': '番号',
                '女优': '女优',
                '出演者': '女优',
                '发行商': '发行商',
                '系列': '系列',
                '类型': '类型',
                '标籤': '标签',
                '发行日期': '发行日期',
                '导演': '导演',
                '男优': '男优'
            },
            // 包含这些类名的元素作为搜索范围
            containerSelectors: ['.space-y-2', '.info-section', '.details-container'],
            // 要排除的类名
            excludeClasses: ['hidden', 'invisible']
        },
        
        // 传统选择器（备用）
        traditional: {
            releaseDate: 'body > div:nth-child(3) > div.sm\\:container.mx-auto.px-4.content-without-search.pb-12 > div > div.flex-1.order-first > div.sm\\:mx-0.mb-8.rounded-0.sm\\:rounded-lg > div:nth-child(2) > div:nth-child(1) > div > div.space-y-2 > div:nth-child(1) > time',
            code: 'body > div:nth-child(3) > div.sm\\:container.mx-auto.px-4.content-without-search.pb-12 > div > div.flex-1.order-first > div.sm\\:mx-0.mb-8.rounded-0.sm\\:rounded-lg > div:nth-child(2) > div:nth-child(1) > div > div.space-y-2 > div:nth-child(2) > span.font-medium',
            title: 'h1',
            actresses: 'body > div:nth-child(3) > div.sm\\:container.mx-auto.px-4.content-without-search.pb-12 > div > div.flex-1.order-first > div.sm\\:mx-0.mb-8.rounded-0.sm\\:rounded-lg > div:nth-child(2) > div:nth-child(1) > div > div.space-y-2 > div:nth-child(4) > a',
            actors: '.actor, .actors, .male-actor, .male-performer, [id*="actor"], [class*="actor"], .male-actor a',
            genres: 'body > div:nth-child(3) > div.sm\\:container.mx-auto.px-4.content-without-search.pb-12 > div > div.flex-1.order-first > div.sm\\:mx-0.mb-8.rounded-0.sm\\:rounded-lg > div:nth-child(2) > div:nth-child(1) > div > div.space-y-2 > div:nth-child(5) > a',
            series: 'body > div:nth-child(3) > div.sm\\:container.mx-auto.px-4.content-without-search.pb-12 > div > div.flex-1.order-first > div.sm\\:mx-0.mb-8.rounded-0.sm\\:rounded-lg > div:nth-child(2) > div:nth-child(1) > div > div.space-y-2 > div:nth-child(5) > a',
            studio: 'body > div:nth-child(3) > div.sm\\:container.mx-auto.px-4.content-without-search.pb-12 > div > div.flex-1.order-first > div.sm\\:mx-0.mb-8.rounded-0.sm\\:rounded-lg > div:nth-child(2) > div:nth-child(1) > div > div.space-y-2 > div:nth-child(6) > a',
            director: 'body > div:nth-child(3) > div.sm\\:container.mx-auto.px-4.content-without-search.pb-12 > div > div.flex-1.order-first > div.sm\\:mx-0.mb-8.rounded-0.sm\\:rounded-lg > div:nth-child(2) > div:nth-child(1) > div > div.space-y-2 > div:nth-child(7) > a',
            tags: 'body > div:nth-child(3) > div.sm\\:container.mx-auto.px-4.content-without-search.pb-12 > div > div.flex-1.order-first > div.sm\\:mx-0.mb-8.rounded-0.sm\\:rounded-lg > div:nth-child(2) > div:nth-child(1) > div > div.space-y-2 > div:nth-child(8) > a',
            image: 'body > div:nth-child(3) > div.sm\\:container.mx-auto.px-4.content-without-search.pb-12 > div > div.flex-1.order-first > div:nth-child(1) > div.relative.-mx-4.sm\\:m-0.-mt-6 > div > div > div.plyr__video-wrapper > div.plyr__poster',
            videoPoster: 'video[playsinline]', // 视频海报选择器
            links: 'a[href]'
        }
    };

    // 存储提取的数据和面板状态
    let extractedData = {};
    let panelStates = {
        configVisible: false  // 关键词配置面板默认隐藏
    };

    // 系统字段列表（不包含在导出结果中，除了原始URL）
    const SYSTEM_FIELDS = ['timestamp', 'extractionMethod'];

    // 设备检测
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isTablet = /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent);

    // 创建控制面板
    function createControlPanel() {
        // 主面板容器
        const panel = document.createElement('div');
        panel.id = 'infoExtractorPanel';
        
        const panelStyles = isMobile ? getMobilePanelStyles() : getDesktopPanelStyles();
        panel.setAttribute('style', panelStyles);

        // 创建面板标题栏
        const title = createPanelHeader();
        
        // 面板控制按钮组
        const panelControls = document.createElement('div');
        panelControls.setAttribute('style', 'display: flex; gap: 8px; margin-bottom: 15px;');

        // 隐藏面板按钮
        const hidePanelBtn = document.createElement('button');
        hidePanelBtn.textContent = '隐藏';
        hidePanelBtn.setAttribute('style', `
            background-color: #f44336;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            flex: 1;
        `);
        hidePanelBtn.addEventListener('click', hideEntirePanel);

        panelControls.appendChild(hidePanelBtn);

        // 智能提取按钮区域
        const smartButtonDiv = document.createElement('div');
        smartButtonDiv.setAttribute('style', 'margin: 15px 0; display: flex; flex-wrap: wrap; gap: 8px;');

        const smartExtractBtn = document.createElement('button');
        smartExtractBtn.textContent = '智能提取';
        smartExtractBtn.setAttribute('style', getButtonStyle('#4CAF50'));
        smartExtractBtn.addEventListener('click', smartExtractFields);

        const traditionalExtractBtn = document.createElement('button');
        traditionalExtractBtn.textContent = '传统提取';
        traditionalExtractBtn.setAttribute('style', getButtonStyle('#2196F3'));
        traditionalExtractBtn.addEventListener('click', extractTraditionalFields);

        smartButtonDiv.appendChild(smartExtractBtn);
        smartButtonDiv.appendChild(traditionalExtractBtn);

        // 按钮区域（导出和复制）
        const buttonDiv = document.createElement('div');
        buttonDiv.setAttribute('style', 'margin: 15px 0; display: flex; flex-wrap: wrap; gap: 8px;');

        const exportBtn = document.createElement('button');
        exportBtn.textContent = '导出JSON';
        exportBtn.setAttribute('style', getButtonStyle('#FF9800'));
        exportBtn.addEventListener('click', exportAsJson);

        const copyBtn = document.createElement('button');
        copyBtn.textContent = '复制结果';
        copyBtn.setAttribute('style', getButtonStyle('#9C27B0'));
        copyBtn.addEventListener('click', copyResults);

        buttonDiv.appendChild(exportBtn);
        buttonDiv.appendChild(copyBtn);


        // 结果显示区域
        const resultDiv = document.createElement('div');
        resultDiv.id = 'extractionResults';
        resultDiv.setAttribute('style', getResultDivStyles());

        // 组装控制面板
        panel.appendChild(title);
        panel.appendChild(panelControls);
        panel.appendChild(smartButtonDiv);
        panel.appendChild(buttonDiv);
        panel.appendChild(resultDiv);

        // 创建浮动显示按钮
        const floatShowBtn = createFloatShowButton();

        document.body.appendChild(panel);
        document.body.appendChild(floatShowBtn);

        // 默认隐藏面板，只显示浮动按钮
        panel.style.display = 'none';
        floatShowBtn.style.display = 'block';
    }

    // 创建面板标题栏
    function createPanelHeader() {
        const title = document.createElement('h3');
        title.textContent = '📋 影片信息提取器';
        title.setAttribute('style', `
            margin: 0 0 15px 0;
            color: #333;
            font-size: 16px;
            font-weight: bold;
            text-align: center;
            padding-bottom: 10px;
            border-bottom: 2px solid #4CAF50;
        `);
        return title;
    }

    // 创建浮动显示按钮
    function createFloatShowButton() {
        const floatShowBtn = document.createElement('button');
        floatShowBtn.id = 'floatShowBtn';
        floatShowBtn.textContent = '📋 显示面板';
        
        const floatBtnStyles = isMobile ? getMobileFloatButtonStyles() : getDesktopFloatButtonStyles();
        floatShowBtn.setAttribute('style', floatBtnStyles);
        floatShowBtn.addEventListener('click', showEntirePanel);
        
        return floatShowBtn;
    }

    // 获取桌面端面板样式
    function getDesktopPanelStyles() {
        return `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            background-color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            font-family: Arial, sans-serif;
            min-width: 350px;
            max-width: 500px;
            max-height: 80vh;
            overflow-y: auto;
        `;
    }

    // 获取移动端面板样式
    function getMobilePanelStyles() {
        return `
            position: fixed;
            top: 10px;
            left: 10px;
            right: 10px;
            z-index: 9999;
            background-color: white;
            padding: 15px;
            border-radius: 12px;
            box-shadow: 0 4px 25px rgba(0,0,0,0.3);
            font-family: Arial, sans-serif;
            max-height: 85vh;
            overflow-y: auto;
        `;
    }

    // 获取桌面端浮动按钮样式
    function getDesktopFloatButtonStyles() {
        return `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9998;
            background-color: #4CAF50;
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 25px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            display: none;
            transition: all 0.3s ease;
        `;
    }

    // 获取移动端浮动按钮样式
    function getMobileFloatButtonStyles() {
        return `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9998;
            background-color: #4CAF50;
            color: white;
            border: none;
            padding: 15px 20px;
            border-radius: 30px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            box-shadow: 0 6px 20px rgba(0,0,0,0.3);
            display: none;
            transition: all 0.3s ease;
        `;
    }

    // 获取按钮样式
    function getButtonStyle(bgColor, width = 'auto') {
        return `
            flex: 1;
            background-color: ${bgColor};
            color: white;
            border: none;
            padding: 10px 16px;
            border-radius: 6px;
            cursor: pointer;
            min-width: 120px;
            width: ${width};
            font-size: 14px;
            font-weight: 500;
            transition: background-color 0.2s ease;
        `;
    }

    // 获取结果区域样式
    function getResultDivStyles() {
        const maxHeight = isMobile ? '250px' : '300px';
        return `
            margin-top: 15px;
            max-height: ${maxHeight};
            overflow: auto;
            border: 1px solid #ddd;
            padding: 12px;
            background-color: #f9f9f9;
            font-size: 13px;
            display: block;
            border-radius: 6px;
        `;
    }


    // 隐藏整个面板
    function hideEntirePanel() {
        const panel = document.getElementById('infoExtractorPanel');
        const floatBtn = document.getElementById('floatShowBtn');
        
        if (panel) {
            panel.style.display = 'none';
        }
        if (floatBtn) {
            floatBtn.style.display = 'block';
            
            // 移动端添加震动反馈
            if (isMobile && navigator.vibrate) {
                navigator.vibrate(50);
            }
        }
    }

    // 显示整个面板
    function showEntirePanel() {
        const panel = document.getElementById('infoExtractorPanel');
        const floatBtn = document.getElementById('floatShowBtn');
        
        if (panel) {
            panel.style.display = 'block';
        }
        if (floatBtn) {
            floatBtn.style.display = 'none';
        }
    }

    // 新增：智能提取函数
    function smartExtractFields() {
        try {
            extractedData = {
                timestamp: new Date().toISOString(),
                原始URL: window.location.href,
                extractionMethod: 'smart'
            };

            // 遍历所有配置的容器选择器
            CONFIG.smartExtract.containerSelectors.forEach(containerSelector => {
                const containers = document.querySelectorAll(containerSelector);
                
                containers.forEach(container => {
                    // 检查是否应该排除此容器
                    if (shouldExcludeElement(container)) return;
                    
                    // 在容器内查找所有span元素
                    const spans = container.querySelectorAll('span');
                    
                    spans.forEach(span => {
                        // 检查是否应该排除此span
                        if (shouldExcludeElement(span)) return;
                        
                        const spanText = span.textContent.trim();
                        
                        // 检查span文本是否匹配任何关键词
                        for (const [keyword, fieldName] of Object.entries(CONFIG.smartExtract.keywordMapping)) {
                            if (spanText.includes(keyword)) {
                                // 找到匹配的关键词，提取同级别内容
                                const contentList = extractSiblingContentAsList(span);
                                if (contentList && contentList.length > 0) {
                                    // 如果字段已存在，合并数组
                                    if (extractedData[fieldName]) {
                                        if (Array.isArray(extractedData[fieldName])) {
                                            extractedData[fieldName] = [...extractedData[fieldName], ...contentList];
                                        } else {
                                            extractedData[fieldName] = [extractedData[fieldName], ...contentList];
                                        }
                                    } else {
                                        // 单个元素存储为字符串，多个元素存储为数组
                                        extractedData[fieldName] = contentList.length === 1 ? contentList[0] : contentList;
                                    }
                                }
                                break; // 找到匹配就跳出循环
                            }
                        }
                    });
                });
            });

            // 特殊处理：提取视频海报图片URL
            const videoPosterUrl = extractVideoPosterUrl();
            if (videoPosterUrl) {
                extractedData['图片URL'] = videoPosterUrl;
            }

            displaySmartResults(extractedData);
            
        } catch (e) {
            console.error('智能提取时出错:', e);
            alert('智能提取时出错，请检查控制台');
        }
    }

    // 辅助函数：提取视频海报URL
    function extractVideoPosterUrl() {
        try {
            const videoElements = document.querySelectorAll(CONFIG.traditional.videoPoster);
            for (let video of videoElements) {
                const dataPost = video.getAttribute('data-poster');
                if (dataPost) {
                    // 转换为绝对URL
                    return new URL(dataPost, window.location).href;
                }
            }
            return null;
        } catch (e) {
            console.error('提取视频海报URL时出错:', e);
            return null;
        }
    }

    // 辅助函数：判断是否应该排除元素
    function shouldExcludeElement(element) {
        // 检查是否有排除的类名
        for (const excludeClass of CONFIG.smartExtract.excludeClasses) {
            if (element.classList.contains(excludeClass)) {
                return true;
            }
        }
        
        // 检查样式是否隐藏
        const computedStyle = window.getComputedStyle(element);
        if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') {
            return true;
        }
        
        return false;
    }

    // 辅助函数：提取同级别内容并返回数组列表
    function extractSiblingContentAsList(targetSpan) {
        try {
            const parent = targetSpan.parentElement;
            if (!parent) return [];

            let contentList = [];
            
            // 方法1：查找同级的所有非script元素
            const siblings = Array.from(parent.children);
            siblings.forEach(sibling => {
                if (sibling !== targetSpan && sibling.tagName !== 'SCRIPT') {
                    const text = sibling.textContent.trim();
                    if (text && !shouldExcludeElement(sibling)) {
                        // 如果是链接元素，可能包含多个标签
                        if (sibling.tagName === 'A' || sibling.querySelectorAll('a').length > 0) {
                            // 提取所有链接文本
                            const links = sibling.tagName === 'A' ? [sibling] : sibling.querySelectorAll('a');
                            links.forEach(link => {
                                const linkText = link.textContent.trim();
                                if (linkText) {
                                    contentList.push(linkText);
                                }
                            });
                        } else {
                            // 普通文本元素
                            contentList.push(text);
                        }
                    }
                }
            });

            // 方法2：如果同级没找到，查找父级的其他子元素
            if (contentList.length === 0) {
                const parentSiblings = Array.from(parent.parentElement.children);
                parentSiblings.forEach(sibling => {
                    if (sibling !== parent) {
                        const text = sibling.textContent.trim();
                        if (text && !shouldExcludeElement(sibling)) {
                            contentList.push(text);
                        }
                    }
                });
            }

            // 方法3：查找相邻的文本节点
            if (contentList.length === 0) {
                const parentChildNodes = parent.childNodes;
                parentChildNodes.forEach(node => {
                    if (node.nodeType === Node.TEXT_NODE) {
                        const text = node.textContent.trim();
                        if (text) {
                            contentList.push(text);
                        }
                    }
                });
            }

            // 去重并返回结果
            return [...new Set(contentList.filter(item => item.length > 0))];
            
        } catch (e) {
            console.error('提取同级别内容时出错:', e);
            return [];
        }
    }

    // 显示智能提取结果（恢复原来的显示格式）
    function displaySmartResults(data) {
        const resultDiv = document.getElementById('extractionResults');
        if (!resultDiv) return;

        // 确保结果面板是可见的
        resultDiv.style.display = 'block';
        panelStates.resultsVisible = true;

        // 清空之前的结果
        resultDiv.innerHTML = '';

        // 创建结果展示
        const resultTitle = document.createElement('h4');
        resultTitle.textContent = '智能提取结果';
        resultTitle.setAttribute('style', 'margin-top: 0; color: #333;');
        resultDiv.appendChild(resultTitle);

        // 不再显示基础信息（提取方式、原始URL、时间戳）

        // 显示提取的字段
        let fieldCount = 0;
        Object.entries(data).forEach(([key, value]) => {
            // 跳过系统字段
            if (SYSTEM_FIELDS.includes(key)) return;
            
            fieldCount++;
            const fieldDiv = document.createElement('div');
            fieldDiv.setAttribute('style', 'margin: 10px 0; padding: 10px; background-color: #fff; border-left: 3px solid #4CAF50; border-radius: 4px;');
            
            const keySpan = document.createElement('span');
            keySpan.setAttribute('style', 'font-weight: bold; color: #4CAF50; margin-right: 12px;');
            keySpan.textContent = `${key}:`;
            
            const valueSpan = document.createElement('span');
            if (Array.isArray(value)) {
                valueSpan.textContent = value.join(', ');
            } else {
                valueSpan.textContent = String(value);
            }
            
            fieldDiv.appendChild(keySpan);
            fieldDiv.appendChild(valueSpan);
            resultDiv.appendChild(fieldDiv);
        });

        // 添加统计信息
        if (fieldCount === 0) {
            const noData = document.createElement('p');
            noData.textContent = '未找到匹配的字段，请检查页面结构或调整关键词配置';
            noData.setAttribute('style', 'color: #f44336; font-style: italic;');
            resultDiv.appendChild(noData);
        } else {
            const statsDiv = document.createElement('div');
            statsDiv.setAttribute('style', 'margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;');
            statsDiv.innerHTML = `<strong>总计:</strong> 成功提取 ${fieldCount} 个字段`;
            resultDiv.appendChild(statsDiv);
        }
    }

    // 传统提取字段（保持原有功能）
    function extractTraditionalFields() {
        extractedData = {
            发行日期: extractText(CONFIG.traditional.releaseDate),
            番号: extractText(CONFIG.traditional.code),
            标题: extractText(CONFIG.traditional.title),
            女优: extractMultipleText(CONFIG.traditional.actresses),
            男优: extractMultipleText(CONFIG.traditional.actors),
            类型: extractMultipleText(CONFIG.traditional.genres),
            系列: extractText(CONFIG.traditional.series),
            发行商: extractText(CONFIG.traditional.studio),
            导演: extractText(CONFIG.traditional.director),
            标籤: extractMultipleText(CONFIG.traditional.tags),
            图片URL: extractImages(CONFIG.traditional.image),
            原始URL: window.location.href
        };
        
        // 添加系统字段到单独的数组中，不显示在结果里
        extractedData.timestamp = new Date().toISOString();
        extractedData.extractionMethod = 'traditional';

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

    // 显示传统结果（恢复原来的显示格式）
    function displayResults(data) {
        const resultDiv = document.getElementById('extractionResults');
        if (!resultDiv) return;

        // 确保结果面板是可见的
        resultDiv.style.display = 'block';
        panelStates.resultsVisible = true;

        // 清空之前的结果
        resultDiv.innerHTML = '';

        // 创建结果展示
        const resultTitle = document.createElement('h4');
        resultTitle.textContent = '传统字段提取结果';
        resultTitle.setAttribute('style', 'margin-top: 0; color: #333;');
        resultDiv.appendChild(resultTitle);

        // 不再显示基础信息（提取方式、原始URL、时间戳）

        // 显示提取的字段（排除系统字段）
        let fieldCount = 0;
        Object.entries(data).forEach(([key, value]) => {
            // 跳过系统字段
            if (SYSTEM_FIELDS.includes(key)) return;
            
            fieldCount++;
            const fieldDiv = document.createElement('div');
            fieldDiv.setAttribute('style', 'margin: 10px 0; padding: 10px; background-color: #fff; border-left: 3px solid #4CAF50; border-radius: 4px;');
            
            const keySpan = document.createElement('span');
            keySpan.setAttribute('style', 'font-weight: bold; color: #4CAF50; margin-right: 12px;');
            keySpan.textContent = `${key}:`;
            
            const valueSpan = document.createElement('span');
            if (Array.isArray(value)) {
                valueSpan.textContent = value.join(', ');
            } else {
                valueSpan.textContent = String(value);
            }
            
            fieldDiv.appendChild(keySpan);
            fieldDiv.appendChild(valueSpan);
            resultDiv.appendChild(fieldDiv);
        });

        // 添加统计信息
        if (fieldCount === 0) {
            const noData = document.createElement('p');
            noData.textContent = '未找到匹配的字段，请检查页面结构或调整关键词配置';
            noData.setAttribute('style', 'color: #f44336; font-style: italic;');
            resultDiv.appendChild(noData);
        } else {
            const statsDiv = document.createElement('div');
            statsDiv.setAttribute('style', 'margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;');
            statsDiv.innerHTML = `<strong>总计:</strong> 成功提取 ${fieldCount} 个字段`;
            resultDiv.appendChild(statsDiv);
        }
    }

    // 导出为JSON（过滤系统字段，但保留originalURL）
    function exportAsJson() {
        if (!extractedData || Object.keys(extractedData).length === 0) {
            alert('请先提取字段');
            return;
        }

        // 创建不包含系统字段的数据副本（保留originalURL）
        const cleanData = {};
        Object.entries(extractedData).forEach(([key, value]) => {
            if (!SYSTEM_FIELDS.includes(key)) {
                cleanData[key] = value;
            }
        });

        const jsonData = JSON.stringify(cleanData, null, 2);
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

    // 复制结果到剪贴板（过滤系统字段，但保留originalURL）
    function copyResults() {
        if (!extractedData || Object.keys(extractedData).length === 0) {
            alert('请先提取字段');
            return;
        }

        // 创建不包含系统字段的数据副本（保留originalURL）
        const cleanData = {};
        Object.entries(extractedData).forEach(([key, value]) => {
            if (!SYSTEM_FIELDS.includes(key)) {
                cleanData[key] = value;
            }
        });

        navigator.clipboard.writeText(JSON.stringify(cleanData, null, 2))
            .then(() => {
                alert('结果已复制到剪贴板');
            })
            .catch(err => {
                console.error('复制失败: ', err);
                // 降级处理：使用旧方法复制
                const textArea = document.createElement('textarea');
                textArea.value = JSON.stringify(cleanData, null, 2);
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                alert('结果已复制到剪贴板');
            });
    }

    // 添加触摸事件支持（移动端优化）
    function addTouchSupport() {
        if (isMobile) {
            // 为所有按钮添加触摸反馈
            document.addEventListener('touchstart', function(e) {
                if (e.target.tagName === 'BUTTON') {
                    e.target.style.transform = 'scale(0.95)';
                }
            }, { passive: true });

            document.addEventListener('touchend', function(e) {
                if (e.target.tagName === 'BUTTON') {
                    e.target.style.transform = 'scale(1)';
                }
            }, { passive: true });

            // 防止长按选择文本
            document.addEventListener('selectstart', function(e) {
                if (e.target.closest('#infoExtractorPanel') || e.target.id === 'floatShowBtn') {
                    e.preventDefault();
                }
            });
        }
    }

    // 监听窗口大小变化，动态调整布局
    function handleResize() {
        const panel = document.getElementById('infoExtractorPanel');
        const floatBtn = document.getElementById('floatShowBtn');
        
        if (panel && floatBtn) {
            const currentIsMobile = window.innerWidth <= 768;
            
            if (currentIsMobile !== isMobile) {
                // 重新创建面板以适应新设备类型
                panel.remove();
                floatBtn.remove();
                createControlPanel();
            }
        }
    }

    // 初始化脚本
    function init() {
        createControlPanel();
        addTouchSupport();
        window.addEventListener('resize', handleResize);
    }

    // 页面加载完成后初始化
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }
})();