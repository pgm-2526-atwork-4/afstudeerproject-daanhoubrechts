import {
  Component,
  AfterViewInit,
  input,
  output,
  ViewChild,
  ElementRef,
  signal,
  HostListener,
} from '@angular/core';

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

  readonly isBoldActive = signal(false);
  readonly isItalicActive = signal(false);
  readonly isUnderlineActive = signal(false);

  @ViewChild('editor') editorRef!: ElementRef<HTMLDivElement>;

  @HostListener('document:selectionchange')
  onDocumentSelectionChange(): void {
    this.syncToolbarFromSelection();
  }

  ngAfterViewInit(): void {
    if (this.initialValue()) {
      this.editorRef.nativeElement.innerHTML = this.initialValue();
    }
    this.syncToolbarFromSelection();
  }

  applyFormat(command: string): void {
    this.editorRef.nativeElement.focus();
    document.execCommand(command, false, undefined);
    this.syncToolbarFromSelection();
    this.valueChange.emit(this.editorRef.nativeElement.innerHTML);
  }

  onEditorInput(): void {
    this.syncToolbarFromSelection();
    this.valueChange.emit(this.editorRef.nativeElement.innerHTML);
  }

  private syncToolbarFromSelection(): void {
    const root = this.editorRef?.nativeElement;
    if (!root) {
      return;
    }
    const sel = document.getSelection();
    if (!sel || sel.rangeCount === 0) {
      this.clearToolbarActive();
      return;
    }
    let node: Node | null = sel.anchorNode;
    if (!node) {
      this.clearToolbarActive();
      return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
      node = node.parentNode;
    }
    if (!node || !root.contains(node)) {
      this.clearToolbarActive();
      return;
    }
    this.isBoldActive.set(document.queryCommandState('bold'));
    this.isItalicActive.set(document.queryCommandState('italic'));
    this.isUnderlineActive.set(document.queryCommandState('underline'));
  }

  private clearToolbarActive(): void {
    this.isBoldActive.set(false);
    this.isItalicActive.set(false);
    this.isUnderlineActive.set(false);
  }
}
