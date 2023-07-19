'use strict'

const htmlTagReg = /^<[^>]+>/;
const htmlImgTagReg = /^<img[^>]*>$/;
const htmlVideoTagReg = /^<video[^>]*>.*?<\/video>$/ms;
const createTextClass = 'html-diff-create-text-wrapper';
const deleteTextClass = 'html-diff-delete-text-wrapper';
const createBlockClass = 'html-diff-create-block-wrapper';
const deleteBlockClass = 'html-diff-delete-block-wrapper';
const createInlineClass = 'html-diff-create-inline-wrapper';
const deleteInlineClass = 'html-diff-delete-inline-wrapper';
const closeIcon = `<span class="html-diff-close-icon"></span>`;

function dressUpDiffContent(type, words) {
    const wordsLength = words.length;
    if (!wordsLength) {
        return '';
    }
    let result = '';
    let textStartIndex = 0;
    for (let i = 0; i < wordsLength; i++) {
        const word = words[i];
        if (word.match(htmlTagReg)) {
            if (i > textStartIndex) {
                result += dressUpText(type, words.slice(textStartIndex, i));
            }
            textStartIndex = i + 1;
            if (word.match(htmlVideoTagReg)) {
                result += dressUpBlockTag(type, word);
            }
            else if ([htmlImgTagReg].some((item) => word.match(item))) {
                result += dressUpInlineTag(type, word);
            }
            else {
                result += word;
            }
        }
    }
    if (textStartIndex < wordsLength) {
        result += dressUpText(type, words.slice(textStartIndex));
    }
    return result;
}
function dressUpText(type, words) {
    const text = words.join('');
    if (!text.trim())
        return '';
    if (type === 'create')
        return `<span class="${createTextClass}">${text}</span>`;
    if (type === 'delete')
        return `<span class="${deleteTextClass}">${text}</span>`;
    return '';
}
function dressUpInlineTag(type, word) {
    if (type === 'create')
        return `<span class="${createInlineClass}">${word}</span>`;
    if (type === 'delete')
        return `<span class="${deleteInlineClass}">${word}${closeIcon}</span>`;
    return '';
}
function dressUpBlockTag(type, word) {
    if (type === 'create')
        return `<div class="${createBlockClass}">${word}</div>`;
    if (type === 'delete')
        return `<div class="${deleteBlockClass}">${word}${closeIcon}</div>`;
    return '';
}
const htmlStartTagReg = /^<(?<name>[^\s/>]+)[^>]*>$/;
const htmlTagWithNameReg = /^<(?<isEnd>\/)?(?<name>[^\s>]+)[^>]*>$/;
export class HtmlDiff {
    minMatchedSize;
    oldWords = [];
    newWords = [];
    matchedBlockList = [];
    operationList = [];
    unifiedContent;
    sideBySideContents;
    constructor(oldHtml, newHtml, minMatchedSize = 2) {
        this.minMatchedSize = minMatchedSize;
        if (oldHtml === newHtml) {
            this.unifiedContent = oldHtml;
            this.sideBySideContents = [oldHtml, newHtml];
            return;
        }
        this.oldWords = this.convertHtml2Words(oldHtml);
        this.newWords = this.convertHtml2Words(newHtml);
        this.matchedBlockList = this.getMatchedBlockList();
        this.operationList = this.getOperationList();
    }
    convertHtml2Words(html) {
        return html.match(/<video[^>]*>.*?<\/video>|<[^>]+>|\w+\b|\s+|[^<>\w]/msg) || [];
    }
    getMatchedBlockList(oldStart = 0, oldEnd = this.oldWords.length, newStart = 0, newEnd = this.newWords.length, matchedBlockList = []) {
        const matchBlock = this.getBestMatchedBlock(oldStart, oldEnd, newStart, newEnd);
        if (!matchBlock) {
            return [];
        }
        if (oldStart < matchBlock.oldStart && newStart < matchBlock.newStart) {
            this.getMatchedBlockList(oldStart, matchBlock.oldStart, newStart, matchBlock.newStart, matchedBlockList);
        }
        matchedBlockList.push(matchBlock);
        if (oldEnd > matchBlock.oldEnd && newEnd > matchBlock.newEnd) {
            this.getMatchedBlockList(matchBlock.oldEnd, oldEnd, matchBlock.newEnd, newEnd, matchedBlockList);
        }
        return matchedBlockList;
    }
    getBestMatchedBlock(oldStart, oldEnd, newStart, newEnd) {
        let bestMatchedBlock = null;
        for (let i = oldStart; i < oldEnd; i++) {
            const ret = this.slideBestMatchedBlock(i, newStart, Math.min(oldEnd - i, newEnd - newStart));
            if (ret && ret.size > (bestMatchedBlock?.size || 0)) {
                bestMatchedBlock = ret;
            }
        }
        for (let j = newStart; j < newEnd; j++) {
            const ret = this.slideBestMatchedBlock(oldStart, j, Math.min(oldEnd - oldStart, newEnd - j));
            if (ret && ret.size > (bestMatchedBlock?.size || 0)) {
                bestMatchedBlock = ret;
            }
        }
        return bestMatchedBlock;
    }
    slideBestMatchedBlock(addA, addB, len) {
        let maxSize = 0;
        let bestMatchedBlock = null;
        let continuousSize = 0;
        for (let i = 0; i < len; i++) {
            if (this.oldWords[addA + i] === this.newWords[addB + i]) {
                continuousSize++;
            }
            else {
                continuousSize = 0;
            }
            if (continuousSize > maxSize) {
                maxSize = continuousSize;
                bestMatchedBlock = {
                    oldStart: addA + i - continuousSize + 1,
                    oldEnd: addA + i + 1,
                    newStart: addB + i - continuousSize + 1,
                    newEnd: addB + i + 1,
                    size: continuousSize,
                };
            }
        }
        return maxSize >= this.minMatchedSize ? bestMatchedBlock : null;
    }
    getOperationList() {
        const operationList = [];
        let walkIndexOld = 0;
        let walkIndexNew = 0;
        for (const matchedBlock of this.matchedBlockList) {
            const isOldStartIndexMatched = walkIndexOld === matchedBlock.oldStart;
            const isNewStartIndexMatched = walkIndexNew === matchedBlock.newStart;
            const operationBase = {
                oldStart: walkIndexOld,
                oldEnd: matchedBlock.oldStart,
                newStart: walkIndexNew,
                newEnd: matchedBlock.newStart,
            };
            if (!isOldStartIndexMatched && !isNewStartIndexMatched) {
                operationList.push(Object.assign(operationBase, { type: 'replace' }));
            }
            else if (isOldStartIndexMatched && !isNewStartIndexMatched) {
                operationList.push(Object.assign(operationBase, { type: 'create' }));
            }
            else if (!isOldStartIndexMatched && isNewStartIndexMatched) {
                operationList.push(Object.assign(operationBase, { type: 'delete' }));
            }
            operationList.push({
                oldStart: matchedBlock.oldStart,
                oldEnd: matchedBlock.oldEnd,
                newStart: matchedBlock.newStart,
                newEnd: matchedBlock.newEnd,
                type: 'equal',
            });
            walkIndexOld = matchedBlock.oldEnd;
            walkIndexNew = matchedBlock.newEnd;
        }
        const maxIndexOld = this.oldWords.length;
        const maxIndexNew = this.newWords.length;
        const tailOperationBase = {
            oldStart: walkIndexOld,
            oldEnd: maxIndexOld,
            newStart: walkIndexNew,
            newEnd: maxIndexNew,
        };
        const isOldFinished = walkIndexOld === maxIndexOld;
        const isNewFinished = walkIndexNew === maxIndexNew;
        if (!isOldFinished && !isNewFinished) {
            operationList.push(Object.assign(tailOperationBase, { type: 'replace' }));
        }
        else if (isOldFinished && !isNewFinished) {
            operationList.push(Object.assign(tailOperationBase, { type: 'create' }));
        }
        else if (!isOldFinished && isNewFinished) {
            operationList.push(Object.assign(tailOperationBase, { type: 'delete' }));
        }
        return operationList;
    }
    getUnifiedContent() {
        if (this.unifiedContent !== undefined) {
            return this.unifiedContent;
        }
        let result = '';
        this.operationList.forEach((operation) => {
            var olds,news,deleteOfWords, createOfWords, createIndex, exhaustiveCheck;
            switch (operation.type) {
                case 'equal':
                    for (const word of this.newWords.slice(operation.newStart, operation.newEnd)) {
                        result += word;
                    }
                    break;
                case 'delete':
                    result += dressUpDiffContent('delete', this.oldWords.slice(operation.oldStart, operation.oldEnd));
                    break;
                case 'create':
                    result += dressUpDiffContent('create', this.newWords.slice(operation.newStart, operation.newEnd));
                    break;
                case 'replace':
                    olds= this.oldWords.slice(operation.oldStart, operation.oldEnd);
                    news = this.newWords.slice(operation.newStart, operation.newEnd);
                    if (olds.length === 1 && news.length === 1 && olds[0].match(htmlTagReg) && news[0].match(htmlTagReg)) {
                        result += news[0];
                        break;
                    }
                    deleteOfWords = [];
                    createOfWords = [];
                    createIndex = operation.newStart;
                    for (let deleteIndex = operation.oldStart; deleteIndex < operation.oldEnd; deleteIndex++) {
                        const deleteWord = this.oldWords[deleteIndex];
                        const matchTagResultD = deleteWord.match(htmlTagWithNameReg);
                        if (matchTagResultD) {
                            if ([htmlImgTagReg, htmlVideoTagReg].some(item => deleteWord.match(item))) {
                                deleteOfWords.push(deleteWord);
                                continue; 
                            }
                            result += dressUpDiffContent('delete', deleteOfWords);
                            deleteOfWords.splice(0);
                            let isTagInNewFind = false;
                            for (let tempCreateIndex = createIndex; tempCreateIndex < operation.newEnd; tempCreateIndex++) {
                                const createWord = this.newWords[tempCreateIndex];
                                const matchTagResultC = createWord.match(htmlTagWithNameReg);
                                if (matchTagResultC
                                    && matchTagResultC.groups.name === matchTagResultD.groups.name
                                    && matchTagResultC.groups.isEnd === matchTagResultD.groups.isEnd) {
                                    isTagInNewFind = true;
                                    result += dressUpDiffContent('create', createOfWords);
                                    result += createWord;
                                    createOfWords.splice(0);
                                    createIndex = tempCreateIndex + 1;
                                    break;
                                }
                                else {
                                    createOfWords.push(createWord);
                                }
                            }
                            if (!isTagInNewFind) {
                                result += deleteWord;
                                createOfWords.splice(0);
                            }
                        }
                        else {
                            deleteOfWords.push(deleteWord);
                        }
                    }
                    if (createIndex < operation.newEnd) {
                        createOfWords.push(...this.newWords.slice(createIndex, operation.newEnd));
                    }
                    result += dressUpDiffContent('delete', deleteOfWords);
                    result += dressUpDiffContent('create', createOfWords);
                    break;
                default:
                    exhaustiveCheck = operation.type;
                    console.error('Error operation type: ' + exhaustiveCheck);
            }
        });
        this.unifiedContent = result;
        return result;
    }
    getSideBySideContents() {
        if (this.sideBySideContents !== undefined) {
            return this.sideBySideContents;
        }
        let oldHtml = '';
        let newHtml = '';
        let equalSequence = 0;
        this.operationList.forEach((operation) => {
            let equalWords, equalString, deleteWords, createWords,deleteOfReplaceWords, createOfReplaceWords,exhaustiveCheck;
            switch (operation.type) {
                case 'equal':
                    equalWords = this.newWords.slice(operation.newStart, operation.newEnd);
                    equalString = '';
                    for (const word of equalWords) {
                        const startTagMatch = word.match(htmlStartTagReg);
                        if (startTagMatch) {
                            equalSequence += 1;
                            const tagNameLength = startTagMatch.groups.name.length + 1;
                            equalString += `${word.slice(0, tagNameLength)} data-seq="${equalSequence}"${word.slice(tagNameLength)}`;
                        }
                        else {
                            equalString += word;
                        }
                    }
                    oldHtml += equalString;
                    newHtml += equalString;
                    break;
                case 'delete':
                    deleteWords = this.oldWords.slice(operation.oldStart, operation.oldEnd);
                    oldHtml += dressUpDiffContent('delete', deleteWords);
                    break;
                case 'create':
                    createWords = this.newWords.slice(operation.newStart, operation.newEnd);
                    newHtml += dressUpDiffContent('create', createWords);
                    break;
                case 'replace':
                    deleteOfReplaceWords = this.oldWords.slice(operation.oldStart, operation.oldEnd);
                    oldHtml += dressUpDiffContent('delete', deleteOfReplaceWords);
                    createOfReplaceWords = this.newWords.slice(operation.newStart, operation.newEnd);
                    newHtml += dressUpDiffContent('create', createOfReplaceWords);
                    break;
                default:
                    exhaustiveCheck = operation.type;
                    console.error('Error operation type: ' + exhaustiveCheck);
            }
        });
        const result = [oldHtml, newHtml];
        this.sideBySideContents = result;
        return result;
    }
}