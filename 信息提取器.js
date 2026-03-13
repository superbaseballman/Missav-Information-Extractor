// ==UserScript==
// @name         成人影片信息提取器
// @namespace    http://tampermonkey.net/
// @version      2.3
// @description  专门用于提取成人影片网站的元数据信息，支持智能识别、面板隐藏显示和移动端适配
// @author       superbaseballman
// @match        https://missav.live/*
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
        
        // css选择器（备用）
        traditional: {
            releaseDate: '',
            code: '',
            title: 'h1',
            actresses: '',
            description: 'div.mb-1.text-secondary.break-all.line-clamp-none', 
            actors: '',
            genres: '',
            series: '',
            studio: '',
            director: '',
            tags: '',
            image: '',
            // 修改videoPoster配置结构，支持指定属性类型
            // 使用示例：
            // 1. 读取data-post属性：{ selector: '[data-post]', attribute: 'data-post' }
            // 2. 读取poster属性：{ selector: 'video', attribute: 'poster' }
            // 3. 读取src属性：{ selector: 'img.poster', attribute: 'src' }
            // 4. 兼容旧格式（仍可使用字符串）：'video[playsinline]'
            videoPoster: {
                selector: 'video[playsinline]',  // CSS选择器
                attribute: 'data-poster'    // 要读取的属性名称
            },
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

    // 定义需要提取的核心字段
    const CORE_FIELDS = ['番号', '标题', '女优', '简介', '标签', '类型', '发行商', '系列', '发行日期', '导演', '男优'];

    // 创建控制面板
    function createControlPanel() {
        // 主面板容器
        const panel = document.createElement('div');
        panel.id = 'infoExtractorPanel';
        
        const panelStyles = isMobile ? getMobilePanelStyles() : getDesktopPanelStyles();
        panel.setAttribute('style', panelStyles);
        
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
        traditionalExtractBtn.textContent = 'css提取';
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

    // 新增：智能提取函数（带 css 提取后备）
    function smartExtractFields() {
        try {
            // 第一步：先展开"显示更多"内容
            expandShowMoreContent();
            
            // 等待短暂延迟后执行提取
            setTimeout(() => {
                extractedData = {
                    timestamp: new Date().toISOString(),
                    原始URL: window.location.href,
                    extractionMethod: 'smart_with_fallback'
                };

                // 第二步：执行智能提取
                performSmartExtraction();

                // 第三步：检查缺失字段并使用 css 方法补充
                fillMissingFieldsWithTraditional();

                // 第四步：特殊处理视频海报 URL
                const videoPosterUrl = extractVideoPosterUrl();
                if (videoPosterUrl) {
                    extractedData['图片URL'] = videoPosterUrl;
                }
                // 第五步：提取页面中所有的 m3u8 链接（如果有）
                let m3u8List = new Set();

                // 仅扫描页面所有网络请求（最有效）
                performance.getEntriesByType("resource").forEach(entry => {
                    const url = entry.name;
                    if (url && url.includes('.m3u8')) {
                        m3u8List.add(url);
                    }
                });
                
                const list = Array.from(m3u8List);
                if (list.length > 0) {
                    console.log("✅ 抓取到 m3u8 地址：\n");
                    list.forEach((url, i) => console.log(`${i + 1}. ${url}`));
                    // 显示选择对话框让用户选择要使用的地址
                    showM3u8SelectionDialog(list);
                } else {
                    console.log("❌ 未找到 m3u8 地址");
                }
            }, 300); // 等待 300ms 让 DOM 更新
            
        } catch (e) {
            console.error('智能提取时出错:', e);
            alert('智能提取时出错，请检查控制台');
        }
    }

    // 展开"显示更多"内容
    function expandShowMoreContent() {
        try {
            // 查找所有包含"显示更多"文本的链接
            const showMoreLinks = Array.from(document.querySelectorAll('a'))
                .filter(link => link.textContent.trim() === '显示更多');
            
            if (showMoreLinks.length > 0) {
                // 点击第一个匹配的链接
                showMoreLinks[0].click();
                console.log('已点击"显示更多"链接');
                
                // 如果是 Vue 应用，可能需要触发@click.prevent
                // 尝试直接修改 v-show/v-if 绑定的数据
                const vueApp = document.querySelector('[vue]') || document.body;
                // 尝试查找并修改 showMore 状态（如果存在 Vue 实例）
                if (window.__vue_app__) {
                    try {
                        const app = window.__vue_app__;
                        // 这里可以尝试访问 Vue 实例的状态
                        console.log('检测到 Vue 应用，尝试自动展开');
                    } catch (e) {
                        console.log('无法访问 Vue 实例状态');
                    }
                }
            } else {
                console.log('未找到"显示更多"链接');
            }
        } catch (e) {
            console.error('展开"显示更多"内容时出错:', e);
        }
    }

    // 执行智能提取的核心逻辑
    function performSmartExtraction() {
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
    }

    // 使用css方法填充缺失字段
    function fillMissingFieldsWithTraditional() {
        const missingFields = CORE_FIELDS.filter(field => !extractedData[field]);
        
        if (missingFields.length > 0) {
            console.log(`发现缺失字段: ${missingFields.join(', ')}，使用css方法补充`);
            
            // 为每个缺失字段尝试css提取
            missingFields.forEach(field => {
                const traditionalValue = extractFieldTraditionally(field);
                if (traditionalValue && 
                    ((Array.isArray(traditionalValue) && traditionalValue.length > 0) || 
                     (!Array.isArray(traditionalValue) && traditionalValue.toString().trim()))) {
                    extractedData[field] = traditionalValue;
                    console.log(`成功补充字段 "${field}"`);
                }
            });
        }
    }

    // 根据字段名使用对应的css选择器提取
    function extractFieldTraditionally(fieldName) {
        switch (fieldName) {
            case '番号':
                return extractText(CONFIG.traditional.code);
            case '标题':
                return extractText(CONFIG.traditional.title);
            case '女优':
                return extractMultipleText(CONFIG.traditional.actresses);
            case '简介':
                return extractText(CONFIG.traditional.description);
            case '男优':
                return extractMultipleText(CONFIG.traditional.actors);
            case '类型':
                return extractMultipleText(CONFIG.traditional.genres);
            case '系列':
                return extractText(CONFIG.traditional.series);
            case '发行商':
                return extractText(CONFIG.traditional.studio);
            case '导演':
                return extractText(CONFIG.traditional.director);
            case '标签':
                return extractMultipleText(CONFIG.traditional.tags);
            case '发行日期':
                return extractText(CONFIG.traditional.releaseDate);
            default:
                return null;
        }
    }

    // 辅助函数：提取文本内容
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

    // 辅助函数：提取多个文本项（如女优列表）
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

    // 辅助函数：提取视频海报URL（支持配置化属性读取）
    function extractVideoPosterUrl() {
        try {
            const config = CONFIG.traditional.videoPoster;
            
            // 兼容旧的字符串配置格式
            if (typeof config === 'string') {
                // 使用现有的extractImages函数处理
                const posterUrls = extractImages(config);
                return posterUrls && posterUrls.length > 0 ? posterUrls[0] : null;
            }
            
            // 新的配置对象格式
            if (typeof config === 'object' && config.selector && config.attribute) {
                const elements = document.querySelectorAll(config.selector);
                
                for (let element of elements) {
                    const attrValue = element.getAttribute(config.attribute);
                    if (attrValue) {
                        // 转换为绝对URL
                        try {
                            return new URL(attrValue, window.location).href;
                        } catch (e) {
                            console.warn(`无效的URL格式: ${attrValue}`);
                            return attrValue; // 返回原始值
                        }
                    }
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

    // css提取字段（保持原有功能）
    function extractTraditionalFields() {
        extractedData = {
            发行日期: extractText(CONFIG.traditional.releaseDate),
            番号: extractText(CONFIG.traditional.code),
            标题: extractText(CONFIG.traditional.title),
            女优: extractMultipleText(CONFIG.traditional.actresses),
            简介: extractText(CONFIG.traditional.description),
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

    // 提取图片链接（增强版，支持多种属性）
    function extractImages(selector) {
        try {
            const elements = document.querySelectorAll(selector);
            return Array.from(elements)
                .map(el => {
                    // 按优先级尝试获取图片URL
                    let src = el.src || 
                             el.getAttribute('src') ||
                             el.getAttribute('data-src') || 
                             el.getAttribute('data-original') ||
                             el.getAttribute('data-post') ||  // 视频海报常用
                             el.getAttribute('data-lazy') ||   // 懒加载图片
                             el.getAttribute('data-image') ||  // 自定义图片属性
                             el.getAttribute('poster');        // 视频海报属性
                    
                    return src;
                })
                .filter(src => src)  // 过滤掉空值
                .map(src => {
                    // 转换为绝对URL
                    try {
                        return new URL(src, window.location).href;
                    } catch (e) {
                        console.warn('无效的URL格式:', src);
                        return src; // 如果转换失败，返回原始值
                    }
                });
        } catch (e) {
            console.error(`图片选择器错误: ${selector}`, e);
            return [];
        }
    }
    // 显示 m3u8 地址选择对话框
    function showM3u8SelectionDialog(m3u8List) {
        if (m3u8List.length === 0) return;
        
        // 创建模态对话框
        const dialog = document.createElement('div');
        dialog.setAttribute('style', `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            z-index: 10000;
            display: flex;
            justify-content: center;
            align-items: center;
        `);
        
        const dialogContent = document.createElement('div');
        dialogContent.setAttribute('style', `
            background-color: white;
            padding: 25px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        `);
        
        const title = document.createElement('h3');
        title.textContent = `找到 ${m3u8List.length} 个 m3u8 地址`;
        title.setAttribute('style', 'margin-top: 0; color: #4CAF50;');
        dialogContent.appendChild(title);
        
        const description = document.createElement('p');
        description.textContent = '请选择要使用的视频地址：';
        description.setAttribute('style', 'color: #666; margin-bottom: 15px;');
        dialogContent.appendChild(description);
        
        // 创建地址列表
        const listContainer = document.createElement('div');
        listContainer.setAttribute('style', 'max-height: 400px; overflow-y: auto; margin-bottom: 20px;');
        
        m3u8List.forEach((url, index) => {
            const itemDiv = document.createElement('div');
            itemDiv.setAttribute('style', `
                padding: 12px;
                margin-bottom: 10px;
                border: 2px solid #ddd;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.2s ease;
            `);
            
            itemDiv.addEventListener('mouseenter', function() {
                this.style.borderColor = '#4CAF50';
                this.style.backgroundColor = '#f1f8f4';
            });
            
            itemDiv.addEventListener('mouseleave', function() {
                this.style.borderColor = '#ddd';
                this.style.backgroundColor = 'white';
            });
            
            const numberSpan = document.createElement('span');
            numberSpan.textContent = `${index + 1}. `;
            numberSpan.setAttribute('style', 'font-weight: bold; color: #4CAF50; margin-right: 8px;');
            
            const urlSpan = document.createElement('span');
            urlSpan.textContent = url;
            urlSpan.setAttribute('style', 'word-break: break-all; font-size: 13px;');
            
            itemDiv.appendChild(numberSpan);
            itemDiv.appendChild(urlSpan);
            
            // 点击选择并保存选中的地址
            itemDiv.addEventListener('click', function() {
                // 将选中的地址存入 extractedData
                extractedData['视频地址'] = url;
                
                document.body.removeChild(dialog);
                
                // 刷新结果显示
                displaySmartResults(extractedData);

            });
            
            listContainer.appendChild(itemDiv);
        });
        
        dialogContent.appendChild(listContainer);
        
        // 添加关闭按钮
        const closeButton = document.createElement('button');
        closeButton.textContent = '取消';
        closeButton.setAttribute('style', `
            background-color: #f44336;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            width: 100%;
        `);
        closeButton.addEventListener('click', function() {
            document.body.removeChild(dialog);
        });
        
        dialogContent.appendChild(closeButton);
        dialog.appendChild(dialogContent);
        document.body.appendChild(dialog);
    }

    // 显示 css 结果（恢复原来的显示格式）
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
        resultTitle.textContent = 'css字段提取结果';
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