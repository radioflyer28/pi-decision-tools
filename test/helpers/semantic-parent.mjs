/** Test adapter only: exercises shared execution, not a semantic search implementation. */
export class SemanticParent {
  constructor(coordinator, records, expansionObligations = 0) {
    this.coordinator = coordinator;
    this.records = records;
    this.model = coordinator.controls.authorize('semantic');
    this.expansionObligations = expansionObligations;
    this.offset = 0;
    this.abort = new AbortController();
    this.pages = [];
  }
  get complete() { return this.offset === this.records.length && this.expansionObligations === 0; }
  cancel() { this.abort.abort(); }
  async step(count = 1) {
    const result = await this.coordinator.submit({
      items: this.records.slice(this.offset, this.offset + count).map((text,i) => ({id:String(this.offset+i),inputVersion:'1',state:{text}})),
      rubricVersion:'fixture-only',questions:{q:{type:'bool',instructions:'Synthetic parent fixture?',criteria:{true:'yes',false:'no'}}},run:{},
    }, 'semantic', {signal:this.abort.signal}, this.model);
    if(result.data.ok) {
      const page=result.data.value;this.pages.push(page);
      this.offset += page.counts.completed + page.counts.failed;
    }
    return result;
  }
}
