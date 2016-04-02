/* global Firepad */
/* global Firebase */
/* global ace */
import {inject} from 'aurelia-framework';
import {EventAggregator} from 'aurelia-event-aggregator';
import '../mode-html';
import '../theme-chrome';


@inject(EventAggregator)
export class HtmlEditor {

  constructor(eventAggregator) {
        this.eventAggregator = eventAggregator;
    }
    
  activate(params) {
    if (params.id) {
      this.pastebinId = params.id;
    } 
  }
  attached(params) {
    if (params.id) {
      this.pastebinId = params.id;
    }

    this.pastebinId = params.id;

    let editor = ace.edit('aceHtmlEditorDiv');
    this.configureEditor(editor);
    
    this.editor = editor;

    let session = editor.getSession();
    this.configureSession(session);

    let selection = editor.getSelection();

    this.session = session;
    this.selection = selection;
    this.firepad = this.createFirepad(editor);        
    this.setupSessionEvents(session);
  }
 
    

  configureEditor(editor) {
    editor.setTheme('ace/theme/chrome');
    editor.setShowFoldWidgets(false);
  }

  configureSession(session) {
    session.setUseWrapMode(true);
    session.setUseWorker(false);
    session.setMode('ace/mode/html');
  } 

  createFirepad(editor) {
    let baseURL = 'https://seecoderun.firebaseio.com';
    let firebase = new Firebase(baseURL + '/' + this.pastebinId + '/content/html');
var firepad = Firepad.fromACE(firebase, editor, 
    { defaultText: '<!DOCTYPE html>\n<html>\n<head>\n\t<meta charset="utf-8">\n\t<title>Coode</title>\n</head>\n'
            + '<body>\n\n</body>\n</html>' });
  }



setupSessionEvents(session) {
      let ea = this.eventAggregator;
      let editor = this.editor;
      
      session.on('change', onEditorChanged);
      
      let editorChangedTimeout;
      
      function onEditorChanged(e) {
          clearTimeout(editorChangedTimeout);
          editorChangedTimeout = setTimeout(function pub() {
              ea.publish('onHtmlEditorChanged', editor.getValue());
          }, 2500);
      }
      
      this.editorChangedTimeout = editorChangedTimeout;
  }
  
  
}