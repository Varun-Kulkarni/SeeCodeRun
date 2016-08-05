/* global $ */
import {TraceService} from '../traceService/trace-service';
import {ExternalResourceLoader}  from '../utils/external-resource-loader';
import {HtmlParser} from '../utils/html-parser';

export class HtmlViewer {
    errors = "";
    html = "";
    css = "";
    js = "";
    constructor(eventAggregator, traceModel) {
        this.eventAggregator = eventAggregator;
        this.traceService = new TraceService(eventAggregator, traceModel);
        this.htmlParser = new HtmlParser();
        this.externalResourceLoader = new ExternalResourceLoader();
        this.div = 'htmlView';
        this.subscribe();
    }

    pushError(errorRef){
      let error = "{";
      if(errorRef){
        error += "details: '"+ errorRef.toString() + "'";
        if(this.aceErrorRange){
          error += ", range: '" + JSON.stringify(this.aceErrorRange) + "'";
        }
      }
      error += "}";
      this.errors = this.errors? this.errors + ", "  + error : error;
    }

    popErrors(){
      let poppedErrors = this.errors;
      this.errors = "";
      return poppedErrors;
    }

    attached() {
      this.addConsoleLogging(this.eventAggregator);
      this.addErrorLogging(this.eventAggregator);
    }

    buildOutput(){
      if(this.js && this.css && this.html){
        this.eventAggregator.publish("beforeOutputBuild");
        this.addCss();
      }
    }

    subscribe() {
      let ea = this.eventAggregator;
      let traceService = this.traceService;

      ea.subscribe('onHtmlEditorChanged', htmlContent => {
        this.html = htmlContent;
        this.buildOutput();
      });

      ea.subscribe('onCssEditorChanged', cssContent => {
        this.css = cssContent;
        this.buildOutput();
      });

      ea.subscribe('jsEditorChange', jsEditorData => {
        let editorText = jsEditorData.js;
        let instrumentationPayload = traceService.getInstrumentation(editorText);

        if (traceService.isValid(instrumentationPayload)) {
          this.js = instrumentationPayload.data;
        } else {
          this.js = editorText;
        }

        this.buildOutput();
      });

      ea.subscribe("headJsScriptsLoaded", scriptsLoadedData => {
        this.handleResponse("head", scriptsLoadedData.response);
        this.addHtml();
      });

      ea.subscribe("bodyJsScriptsLoaded", scriptsLoadedData => {
        this.handleResponse("body", scriptsLoadedData.response);
        this.addJs();
      });
    }

    handleResponse(elementName, response){
      let status = {done: "done", fail: "fail"};
      if(response.status === status.fail){
        for(let responseIndex in response.responses){
          let details = response.responses[responseIndex];
          if(details.status === status.fail){
             this.eventAggregator.publish("htmlViewerWindowError", {arguments: { error: elementName + ": download script failed", details: details}});
          }
        }
      }
    }

    addJs() {
      let self = this;
      let ea = this.eventAggregator;
      let traceService = this.traceService;
      let traceDataContainer = traceService.traceModel.traceDataContainer;

      let doc = this.getContentDocument();
      let scriptElement = this.externalResourceLoader.createScriptElement(this.js, doc);

      self.result = {error: ""};

      try {
        ea.publish(traceService.executionEvents.running.event);

        doc.head.appendChild(scriptElement);
        // doc.body.textContent =this.js;
        let traceDataContainerElement = doc.getElementById(traceDataContainer);
        self.result = JSON.parse(traceDataContainerElement.textContent);

        traceDataContainerElement.addEventListener("click", function getTraceDataClick(){
            self.result = JSON.parse(traceDataContainerElement.textContent);
            self.result.error = self.popErrors();
            ea.publish(
              traceService.executionEvents.finished.event, {
                data: self.result
            });
        });

        self.result.error = this.popErrors();

        ea.publish(
          traceService.executionEvents.finished.event, {
            data: self.result
        });
      } catch(e) {
        this.pushError(e);

        try {
          self.result = JSON.parse(doc.getElementById(traceDataContainer).textContent);
        } catch (jsonError) {
          if(e.toString() !== jsonError.toString()){
            this.pushError(jsonError);
          }
        }
        self.result.error = this.popErrors();
        ea.publish(
          traceService.executionEvents.finished.event, {
            data: self.result
          });
      }
    }

    addCss() {
      let doc = this.getContentDocument();
      let styleElement = this.externalResourceLoader.createStyleElement(this.css, doc);

      let parsedHtml = this.htmlParser.parseHtmlRemoveTags(this.html);
      let newHead = parsedHtml.head;
      let newHeadAttributes = parsedHtml.headAttributes;
      doc.head.innerHTML = newHead;
      this.htmlParser.setAttributes($(doc.head), newHeadAttributes);
      doc.head.appendChild(styleElement);
      this.externalResourceLoader.loadAndAttachJsScripts(doc.head, doc, this.eventAggregator, "headJsScriptsLoaded");

    }

    addHtml() {
      let doc = this.getContentDocument();
      let parsedHtml = this.htmlParser.parseHtmlRemoveTags(this.html);
      let newBody = parsedHtml.body;
      let newBodyAttributes = parsedHtml.bodyAttributes;
      doc.body.innerHTML = newBody;
      this.htmlParser.setAttributes($(doc.body), newBodyAttributes);
      this.externalResourceLoader.loadAndAttachJsScripts(doc.body, doc, this.eventAggregator, "bodyJsScriptsLoaded");
    }

    getContentDocument() {
      return document.getElementById(this.div)
                     .contentDocument;
    }

    addErrorLogging(eventAggregator) {
      let self = this;
      let ea = eventAggregator;
      let contentWindow = this.getContentWindow();

      contentWindow.onerror = function hmtlViewerWindowOnerror(message) {
        self.aceErrorRange = null;
        if(self.result && self.result.lastExpressionRange){
            self.aceErrorRange = self.result.lastExpressionRange;
        }
        self.pushError(message);
        // let data = {};
        // try{
        //   data = JSON.parse();
        // }catch(e){}

        // if(data.indexInTimeline == null){
        //   return;
        // }
        ea.publish('htmlViewerWindowError', {
          this: this,
          arguments: message,
          aceErrorRange: message.replace("Uncaught ", "")
        });
      };
    }

    addConsoleLogging(eventAggregator) {
      let self = this;
      let ea = eventAggregator;
      let contentWindow = this.getContentWindow();

      contentWindow.console.log = function hmtlViewerConsoleLog() {

        if(arguments){
          self.aceLogRange = arguments[0];
          arguments[0] = undefined;
        }
        ea.publish('htmlViewerConsoleLog', {
          contentWindow: contentWindow,
          this: this,
          arguments: arguments,
          aceLogRange: self.aceLogRange
        });
	    };
    }

    getContentWindow() {
      return document.getElementById(this.div)
                     .contentWindow;
    }
}