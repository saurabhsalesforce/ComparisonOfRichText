import { LightningElement, wire } from 'lwc';

import {diff_match_patch} from "./matchpatchupdated";
import {unified} from "./unified"
import {HtmlDiff} from "./HtmlDiff"

import fetchData from '@salesforce/apex/DataFetchingDemo.fetchData';

export default class Demo extends LightningElement {
    data;
    @wire(fetchData, {reqId: 'a1a7x0000004ik1AAA'})
    wiredData({ data, error }) {
        if (data) {
            this.data = data;
            console.log(data);
        } else if (error) {
            console.log(error);
        }
    }
    handleClick(){
        const dmp = new diff_match_patch()
        const oHtml = this.data[0].From__c;
        const nHtml = this.data[0].To__c;
        const oldHtml = oHtml.match(/<video[^>]*>.*?<\/video>|<[^>]+>|\w+\b|\s+|[^<>\w]/msg) || [];
        const newHtml = nHtml.match(/<video[^>]*>.*?<\/video>|<[^>]+>|\w+\b|\s+|[^<>\w]/msg) || [];
        const diff = dmp.diff_main(oldHtml,newHtml, false);
        const result = unified(diff);
        const und = this.template.querySelector('div.unified');
        if (und) {
            und.innerHTML = result;
        }
    }
    handleClick2(){
        const oldHtml = this.data[0].From__c;
        const newHtml = this.data[0].To__c;
        const diff = new HtmlDiff(oldHtml, newHtml);
        const unifiedContent = diff.getUnifiedContent()
        const unified = this.template.querySelector('div.unified');
        if (unified) {
            console.log("sk");
            unified.innerHTML = unifiedContent;
            console.log(unifiedContent);
        }
    }
    get firstItemData() {
        if (this.data && this.data.length > 0) {
            return this.data[0];
        }
        return '';
    }
}