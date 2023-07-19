import { LightningElement, wire, api } from 'lwc';

import {diff_match_patch} from "./matchPatchUpdated";
import {unified} from "./unified"

import fetchData from '@salesforce/apex/DataFetchingDemo.fetchData';

export default class EGRCHtmlDIff extends LightningElement {
    connectedCallback() {
        console.log("inside component");
    }
    data;
    @api reqId;
    @wire(fetchData, {reqId: '$reqId'})
    wiredData({ data, error }) {
        if (data) {
            this.data = data;
        } else if (error) {
            console.log(error);
        }
    }
    handleClick(){
        const dmp = new diff_match_patch()
        const oHtml = this.data[0].From__c?this.data[0].From__c:'';
        const nHtml = this.data[0].To__c;
        var oldHtml = oHtml.match(/<video[^>]*>.*?<\/video>|<[^>]+>|\w+\b|\s+|[^<>\w]/msg) || [];
        var newHtml = nHtml.match(/<video[^>]*>.*?<\/video>|<[^>]+>|\w+\b|\s+|[^<>\w]/msg) || [];
        const diff = dmp.diff_main(oldHtml,newHtml, false);
        const result = unified(diff);
        const und = this.template.querySelector('div.unified');
        if (und) {
            und.innerHTML = result;
        }
    }
    handleOkay(){
        const hideDifferenceEvent = new CustomEvent("hideDifference", {
            detail: false
        });
        this.dispatchEvent(hideDifferenceEvent);
    }
    get firstItemData() {
        if (this.data && this.data.length > 0) {
            return this.data[0];
        }
        return '';
    }
    get comparedData() {
        if (this.data && this.data.length > 0) {
        const dmp = new diff_match_patch()
        const oHtml = this.data[0].From__c?this.data[0].From__c:" ";
        const nHtml = this.data[0].To__c?this.data[0].To__c:" ";
        var oldHtml = oHtml.match(/<video[^>]*>.*?<\/video>|<[^>]+>|\w+\b|\s+|[^<>\w]/msg) || [];
        oldHtml = oldHtml.filter(function(str) {
            return /\S/.test(str);
        });
        var newHtml = nHtml.match(/<video[^>]*>.*?<\/video>|<[^>]+>|\w+\b|\s+|[^<>\w]/msg) || [];
        newHtml= newHtml.filter(function(str) {
            return /\S/.test(str);
        });
        const diff = dmp.diff_main(oldHtml,newHtml, false);
        const result = unified(diff);
        return result;
        }
        return 'Nothing to compare';
    }
}