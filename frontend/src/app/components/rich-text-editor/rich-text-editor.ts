import { Component, AfterViewInit, input, output, ViewChild, ElementRef } from '@angular/core';

@Component({
  selector: 'app-rich-text-editor',
  standalone: true,
  templateUrl: './rich-text-editor.html',
  styleUrl: './rich-text-editor.scss',
})
export class RichTextEditor implements AfterViewInit {
  readonly initialValue = input('');
  readonly placeholder = input('Schrijf hier...');
  readonly valueChange = output<string>();

  @ViewChild('editor') editorRef!: ElementRef<HTMLDivElement>;

  ngAfterViewInit(): void {
    if (this.initialValue()) {
      this.editorRef.nativeElement.innerHTML = this.initialValue();
    }
  }

  applyFormat(command: string): void {
    this.editorRef.nativeElement.focus();
    document.execCommand(command, false, undefined);
    this.valueChange.emit(this.editorRef.nativeElement.innerHTML);
  }

  onEditorInput(): void {
    this.valueChange.emit(this.editorRef.nativeElement.innerHTML);
  }
}
