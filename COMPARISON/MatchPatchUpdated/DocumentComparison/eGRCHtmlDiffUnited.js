import { LightningElement, wire, api } from 'lwc';

import {diff_match_patch} from "./matchpatchupdated"

import fetchData from '@salesforce/apex/FetchingRequirements.fetchData';
import fetchData2 from '@salesforce/apex/DataFetchingDemo.fetchData';
import fetchId from '@salesforce/apex/FetchingPublishedDocumentId.fetchId';

const htmlTagReg = /^<[^>]+>/;
export default class EGRCHtmlDiffUnited extends LightningElement {
    renderedCallback() {
        console.log("inside component");
        console.log(this.docId);
    }
    connectedCallback() {
        console.log(this.docId);
    }
    data;
    unifiedResult = new Array();
    id;
    @api docId;
    @wire(fetchId, {docId: '$docId'})
    wiredData({ data, error }) {
        if (data) {
            this.id = data[0].Id;
            this.handleClick();
        } else if (error) {
            console.log("error");
            console.log(error);
        }
    }

    async handleClick(){
        const published_id = this.id;
        const req = await fetchData({published_id});
        if(req){
            this.data = req;
        }
        if(this.data)
        {
            const numberOfRequirements = this.data.length;
            for(var i = 0; i<numberOfRequirements; i++)
            {
                try {
                    const reqId = this.data[i].Match_Id__c;
                    const result = await fetchData2({ reqId });
                    if(result.length)
                    {
                        const finalResult = await this.handleRequirement(result[0]);
                        this.unifiedResult.push({...finalResult, "reqId": reqId});
                    }
                } catch (error) {
                    console.log("error");
                    console.log(error);
                }
            }
            this.getUnifiedResult();
        }
        
    }
    async handleRequirement(result){
        const dmp = new diff_match_patch()
        const oHtml = result.From__c?result.From__c:'';
        const nHtml = result.To__c;
        var oldHtml = oHtml.match(/<video[^>]*>.*?<\/video>|<[^>]+>|\w+\b|\s+|[^<>\w]/msg) || [];
        oldHtml = oldHtml.filter(function(str) {
            return /\S/.test(str);
        });
        var newHtml = nHtml.match(/<video[^>]*>.*?<\/video>|<[^>]+>|\w+\b|\s+|[^<>\w]/msg) || [];
        newHtml= newHtml.filter(function(str) {
            return /\S/.test(str);
        });
        const diff = dmp.diff_main(oldHtml,newHtml, false);
        var newarr = diff.filter(function(a){return a[1].length !== 0})
        const cleanArr = this.cleanArray(newarr);
        const diffs = await this.handleDiffs(cleanArr);
        return diffs;
    }
    cleanArray(newarr){
        var len = newarr.length;
        for(var i=0; i<len-1; i++)
        {
            if(newarr[i][0]===newarr[i+1][0])
            {
                newarr[i][1].push(...newarr[i+1][1]);
                newarr.splice(i+1, 1);
                i--;
                len--;
            }
        }
        return newarr;
    }
    handleDiffs(diff){
        var len = diff.length;
        var inserted='', deleted='', replaced=''; 
        for(var i=0; i<len; i++)
        {
            if(diff[i][0]===-1)
            {
                if(i<len-1 && diff[i+1][0]===1)
                {
                    if((this.wrap(diff[i][1]).trim().length) && (this.wrap(diff[i+1][1]).trim().length)){
                        replaced+= this.wrap(diff[i][1]);
                        replaced+=` <strong>is replaced with</strong> `;
                        replaced+= this.wrap(diff[i+1][1]);
                        replaced+='<br>';
                    }
                    else if(this.wrap(diff[i+1][1]).trim().length){
                        inserted+=this.wrap(diff[i+1][1]);
                        inserted+='<br>';
                    }
                    else if(this.wrap(diff[i][1]).trim().length){
                        deleted+= this.wrap(diff[i][1]);
                        deleted+='<br>';
                    }
                    i++;
                }
                else if(i<len-1 && diff[i+1][0]===0)
                {
                    if(this.wrap(diff[i][1]).trim().length){
                        deleted+= this.wrap(diff[i][1]);
                        deleted+='<br>';
                    }
                    i++;
                }
                else if(i===len-1){
                    if(this.wrap(diff[i][1]).trim().length){
                        deleted+= this.wrap(diff[i][1]);
                        deleted+='<br>';
                    }
                }
            }
            else if(diff[i][0]===1)
            {
                if(this.wrap(diff[i][1]).trim().length){
                    inserted+=this.wrap(diff[i][1]);
                    inserted+='<br>';
                }
            }
        }
        return { "Inserted": inserted, "Deleted": deleted, "Replaced": replaced};
    }
    wrap(txt){
        var str  = '';
        var wrapedTxt = '';
        for(var i=0; i<txt.length; i++)
        {
            if(!txt[i].match(htmlTagReg))
            {
                 if(txt[i]=== "." || txt[i]=== "#" || txt[i]=== "39" || txt[i]=== "#"|| txt[1]=== ";" || txt[1]==='&')
                {

                }
                else{
                    str+=' ';
                }
                str+=txt[i];
            }
            else{
                wrapedTxt+=`${str}`
                str='';
            }
        }
        if(str)
        {
            wrapedTxt+=`${str}`
            str='';
        }
        return wrapedTxt;
    }
    getUnifiedResult(){
        if(this.unifiedResult.length){
            const resultContainer = this.template.querySelector('div.unifiedResult');
            var deleted ='';
            var inserted ='';
            var replaced ='';
            this.unifiedResult.forEach(obj => {
                if(obj.Deleted.length>0)
                {
                    deleted+=`<li>${obj.Deleted}</li><br>`;
                }
                if(obj.Inserted.trim().length>0)
                {
                    inserted+=`<li>${obj.Inserted}</li><br>`;
                }
                if(obj.Replaced.length>0)
                {
                    replaced+=`<li>${obj.Replaced}</li><br>`;
                }
            });
            const divElement = document.createElement("div");
            divElement.style.background = "white";
            divElement.style.margin ="10px";
            divElement.style.border = "2px solid black"
            divElement.style.padding="10px 10px"
            
            divElement.innerHTML = `<h2 style="font-size: 20px ";>Deleted Content: </h2><br>${deleted}<br>`;
            resultContainer.innerHTML = "";
            resultContainer.appendChild(divElement);

            const divElement2 = document.createElement("div");
            divElement2.style.background = "white";
            divElement2.style.margin ="10px";
            divElement2.style.border = "2px solid black"
            divElement2.style.padding="10px 10px"

            divElement2.innerHTML = `<h2 style="font-size: 20px ";>Inserted Content: </h2><br>${inserted}<br>`;
            resultContainer.appendChild(divElement2);

            const divElement3 = document.createElement("div");
            divElement3.style.background = "white";
            divElement3.style.margin ="10px";
            divElement3.style.border = "2px solid black"
            divElement3.style.padding="10px 10px"

            divElement3.innerHTML = `<h2 style="font-size: 20px ";>Updated Content: </h2><br>${replaced}<br>`;
            resultContainer.appendChild(divElement3);
        }
        return ' ';
        
    }
    handleOkay(){
        const hideChangesEvent = new CustomEvent("hideChanges", {
            detail: false
        });
        this.dispatchEvent(hideChangesEvent);
    }
}