/* global $ */
import {bindable} from 'aurelia-framework';

export class JsGutter {
    aceJsEditorDiv = "";
    @bindable jsGutterDiv = "jsGutterDiv";
    jsGutterBlurClass = "js-gutter-blur";
    jsGutterInvalidClass = "js-gutter-invalid";
    jsGutterLineIdPrefix = "jsGutterLine";
    jsGutterLineSelectorPrefix = "#jsGutterLine";
    jsGutterLineClass = "js-gutter-line";
    jsGutterLineClassSelector = ".js-gutter-line";
    jsGutterLineHighlightClass = "js-gutter-line-highlight";
    jsGutterLineHighlightClassSelector = ".js-gutter-line-highlight";
    editorLayout = null;
    selectedLine = '';
    $gutter = null;
    length = 0;
    isTraceServiceProccesing =false;
    isTraceChange = false;
    traceHelper = null;
    scrollTop = 0;
    
    constructor(eventAggregator, aceJsEditorDiv = "aceJsEditorDiv") {
        this.eventAggregator = eventAggregator;
        this.aceJsEditorDiv = aceJsEditorDiv;
    }
    
    update(editorLayout = this.editorLayout, aceJsEditorDiv = this.aceJsEditorDiv){
        let self = this;
        let $jsGutterLineClass =$(self.jsGutterLineClassSelector);
        let $jsGutterLineHighlightClass = $(self.jsGutterLineHighlightClassSelector);
        let $editorDiv =$(`#${aceJsEditorDiv}`);
      
    
        $jsGutterLineClass.css("font-size", $editorDiv.css("font-size"));
        $jsGutterLineClass.css("font-family", $editorDiv.css("font-family"));
        
        $jsGutterLineHighlightClass.css("font-size", $editorDiv.css("font-size"));
        $jsGutterLineHighlightClass.css("font-family", $editorDiv.css("font-family"));
        
        if(!editorLayout){
            return;
        }
        
        let firstLineNumber = editorLayout.firstLineNumber;
        
        self.length = currentLine + editorLayout.lastRow;
        
        self.cleanGutter();
        
        let currentLine = 0;
        let $previousLine = undefined;
        for(let line = editorLayout.firstRow; line <= editorLayout.lastRow; line++){
            currentLine = firstLineNumber + line;
            let newLineId = self.jsGutterLineIdPrefix + currentLine;
            let newLineSelector =  self.jsGutterLineSelectorPrefix + currentLine;
            let $newLine = $(newLineSelector);
            if(!$newLine.length){
                if($previousLine){
                    $("<li id = '" + newLineId + "'></li>").insertAfter($previousLine);
                }else{
                    self.$gutter.append("<li id = '" + newLineId + "'></li>");
                }
                $newLine = $(newLineSelector); 
                $newLine.addClass(self.jsGutterLineClass);
                $newLine.click( function(event){
                    let lineNumber = event.target.id.replace(self.jsGutterLineIdPrefix, "");
                    self.eventAggregator.publish("jsGutterLineClick", lineNumber);
                });
            }
          $newLine.css("height", editorLayout.getRowHeight(line));
          $previousLine = $newLine;
        }
        
        if(self.isTraceChange && self.traceHelper && editorLayout.lastRow){
            self.isTraceChange = false;
            if(self.traceHelper.isValid()){
                let values = self.traceHelper.getValues();
                for (let value of values) {
                    self.setGutterLineContent(value.range.start.row + 1, value.id + " = " + value.value);
                }
                self.eventAggregator.publish("jsGutterContentUpdate", {data:values});
            }
            self.isTraceServiceProccesing = false;
        }
        
        if(self.isTraceServiceProccesing){
            self.$gutter.addClass(self.jsGutterBlurClass);
        }else{
            self.$gutter.removeClass(self.jsGutterBlurClass);
            if(self.traceHelper && self.traceHelper.isValid()){
                self.$gutter.removeClass(self.jsGutterInvalidClass);
            }else{
                if(editorLayout.lastRow){
                    self.$gutter.addClass(self.jsGutterInvalidClass);
                }
            }
        }
        self.$gutter.scrollTop(self.scrollTop);
    }

    attached() {
        this.$gutter = $(`#${this.jsGutterDiv}`);
        this.subscribe();
    }
    
    scrollHandler(event) {
        if (event && event.target){
            let scrollData = {
               scrollTop: event.target.scrollTop
            };
            
            if(this.eventAggregator){
                this.eventAggregator.publish('jsGutterScroll', scrollData);
            }
        }
    }

    subscribe() {
        let self = this;
        let $gutter= this.$gutter;
        let ea = this.eventAggregator;
        
        ea.subscribe("windowResize", layout =>{
            $gutter.height(layout.editorHeight);
            self.update();
          }
        );
        
        ea.subscribe("jsEditorPreChange", layout => {
            this.isTraceServiceProccesing = true;
            // this.clearGutter(); // too distracting
            this.update();
        });
        
        ea.subscribe("jsEditorAfterRender", editorLayout => {
            this.editorLayout = editorLayout;
            this.update();
        });
        
        ea.subscribe("jsEditorResize", editorLayout => {
            this.editorLayout = editorLayout;
            this.update();
        });
        ea.subscribe('onCursorMoved', info => {
            this.selectedLine = info.cursor ||1;
            this.highlightLine(this.selectedLine);
        });

        ea.subscribe("traceChanged", payload => {
            this.isTraceChange = true;
            this.traceHelper = payload.data;
            this.clearGutter();
            this.update();
        });
        
        ea.subscribe("jsEditorChangeScrollTop", scrollData => {
                this.scrollTop = scrollData.scrollTop;
                this.scrollerHeight = scrollData.scrollerHeight;
                // $gutter.scrollerHeight(this.scrollerHeight);
                $gutter.scrollTop(this.scrollTop);
        });
    }

    setGutterLineContent(line, contents) {
        let $line = $(this.jsGutterLineSelectorPrefix + line);
        if ($line.length) {
            $line.append(" [ " + contents + " ] ");
        }
    }

    highlightLine(line) {
        this.$gutter.find(this.jsGutterLineClassSelector).removeClass(this.jsGutterLineHighlightClass);
        let $lineToHighLight = $(this.jsGutterLineSelectorPrefix + line);
        if($lineToHighLight.length){
            $lineToHighLight.addClass(this.jsGutterLineHighlightClass);
            this.selectedLine = line;
        }else{
            this.selectedLine = -1;
        }
    }

    clearGutter() {
        this.$gutter.find(this.jsGutterLineClassSelector).html("");
    }
    
    cleanGutter() {
        let lineNumberToRemove = this.length;
        let $lineToRemove = "";
        do{
           $lineToRemove = $(this.jsGutterLineSelectorPrefix + (++lineNumberToRemove));
        }while($lineToRemove.length && !$lineToRemove.remove());
    }
    
    removeGutterContent() {
        this.$gutter.find(this.jsGutterLineClassSelector).remove();
    }
    
}
