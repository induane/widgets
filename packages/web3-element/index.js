import {LitElement, html} from '@polymer/lit-element';

export default class OrWeb3 extends LitElement {
  static get is() { return "or-web3" };
  _render({hasWeb3, networkSupported}) {
    if(hasWeb3) {
      if(networkSupported) {
        return html`<slot></slot>`;
      } else {
        return html`<slot name="netunsupported">This application does not support the network you are connected to</slot>`;
      }
    } else {
      return html`<slot name="noweb3">You need web3 to view this content</slot>`;
    }
  }
  static get properties() { return {
    hasWeb3: Boolean,
    network: Number,
    networkSupported: Boolean,
    networkCheckInterval: Number,
    accountCheckInterval: Number,
    extend: function(props) {
      for(var key of Object.keys(this)) {
        props[key] = this[key];
      }
      return props;
    }
  }}
  constructor() {
    super();
    this.web3Children = [];
    this.accountCheckInterval = 2000;
    this.networkCheckInterval = 2000;
    this.addEventListener('web3-child', e => this.registerChild(e));
    this.addEventListener('set-web3', e => this.setWeb3(e.detail.web3));
    this.addEventListener('subscribe-block', e => this.registerBlockSubscription(e));
    this.hasWeb3 = false;
    this.topAccount = null;
    this.network = null;
    this.blockWatcher = null;
    this.blockSubscriptions = [];
    this.networkReady = new Promise((resolve) => {
      this._resolveNetwork = resolve;
    })
    this.web3Interval = setInterval(() => {
      if(window.web3 != undefined) {
        this.setWeb3(window.web3);
      }
    }, 100)
  }
  registerChild(e) {
    if(this.web3Children.indexOf(e.detail.element) == -1) {
      this.web3Children.push(e.detail.element);
    }
    if(this.hasWeb3) {
      e.detail.element.dispatchEvent(new CustomEvent('web3-ready', {detail: {web3: this.web3, account: this.topAccount, network: this.network}, bubbles: false, composed: false}));
    }
  }
  registerBlockSubscription(e) {
    this.blockSubscriptions.push(e.detail.element);
    if(!this.blockWatcher && this.web3) {
      this.createBlockWatcher(this.web3);
    }
  }
  createBlockWatcher(web3) {
    if(this.blockWatcher) {
      this.blockWatcher.stopWatching(console.log);
    }
    this.blockWatcher = web3.eth.filter("latest");
    this.blockWatcher.watch((err, hash) => {
      if(err) {
        console.log("Error watching block:", err);
      }
      for(var child of this.blockSubscriptions) {
        child.dispatchEvent(new CustomEvent('block', {detail: {hash: hash}, bubbles: false, composed: false}));
      }
    });
  }
  setWeb3(web3) {
    this.hasWeb3 = true;
    this.web3 = new Web3(web3.currentProvider);
    clearInterval(this.web3Interval);
    for(var child of this.web3Children) {
      child.dispatchEvent(new CustomEvent('web3-ready', {detail: {web3: this.web3}, bubbles: false, composed: false}));
    }
    this.createBlockWatcher(this.web3);
    this.watchAccounts();
    this.watchNetwork();
  }
  watchNetwork() {
    var getNetwork = () => {
      try {
        if(this.network != this.web3.version.network) {
          this.setNetwork(this.web3.version.network);
        }
      } catch (e) {
        this.web3.version.getNetwork((err, network) => {
          if(this.network != network) {
            this.setNetwork(network);
          }
        })
      }
    }
    getNetwork();
    setInterval(() => getNetwork(), this.networkCheckInterval);
  }
  setNetwork(network) {
    this.network = network;
    this.networkSupported = this.supportedNetworks.length == 0 || this.supportedNetworks.indexOf(parseInt(this.network)) > -1;
    this._resolveNetwork(this.network);
    for(var child of this.web3Children) {
      child.dispatchEvent(new CustomEvent('web3-network', {detail: {network: this.network}, bubbles: false, composed: false}));
    }
  }
  watchAccounts() {
    var getAccount = () => {
      try {
        // This is faster with some web3 providers, but not always available
        if(this.topAccount != this.web3.eth.accounts[0]) {
          this.setAccount(this.web3.eth.accounts[0]);
        }
      } catch(e) {
        // This is always available, but not performant with some web3 providers
        this.web3.eth.getAccounts((err, accounts) => {
          if(this.topAccount != accounts[0]) {
            this.setAccount(accounts[0]);
          }
        })
      }
    }
    getAccount();
    setInterval(() => getAccount(), this.accountCheckInterval);
  }
  setAccount(account) {
    this.topAccount = account;
    for(var child of this.web3Children) {
      child.dispatchEvent(new CustomEvent('web3-account', {detail: {account: this.topAccount}, bubbles: false, composed: false}));
    }
  }
  get supportedNetworks() {
    let supportedNetworks = [];
    for(let slot of this.querySelectorAll('[slot="net"]')) {
      supportedNetworks.push(parseInt(slot.innerText));
    }
    return supportedNetworks;
  }
}
window.customElements.define(OrWeb3.is, OrWeb3)
