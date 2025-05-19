import { Component, OnInit } from "@angular/core";
import { Location } from "@angular/common";
import { FormBuilder, Validators } from "@angular/forms";
import { environment } from "../../environments/environment";
import { DepositFormComponent } from "../modals/deposit-form/deposit-form.component";
import { MatDialog, MatDialogConfig } from "@angular/material/dialog";
import { TransactionService } from "../services/transaction.service";
import { WithdrawFormComponent } from "../modals/withdraw-form/withdraw-form.component";
import { DepositAutopayComponent } from "../modals/deposit-autopay/deposit-autopay.component";
import { QrcodeShowComponent } from "../modals/qrcode-show/qrcode-show.component";
import { ToastrService } from "ngx-toastr";
import { HttpClient } from '@angular/common/http';

const QRCode: any = require("qrcode");
interface NetworkDetails {
  address: string;
  qrImage: string;
}
@Component({
  selector: "app-deposit",
  templateUrl: "./deposit.component.html",
  styleUrls: ["./deposit.component.css"],
})
export class DepositsComponent implements OnInit {
  name = "100x Wins";
  qrImageSrc: string = "";

  deposit_requests: any = [];
  withdraw_requests: any = [];
  selectedTabIndex = 0;
  depositAmount: number = 0;
  paymentUrl: any = "";
  isDepositProceed: boolean = false;
  http: HttpClient;

  // manual deposit
  depositForm: any;
  selectedFile: any = null;
  errorMsg: any;
  submitted = false;
  gpay: any = "";
  paytm: any = "";
  phonepe: any = "";
  bank: any = "";
  qrcode: any = "";
  currentPayment: any = "";
  methodval: any = "other";
transactionId: string = '';

  // NEW UI SUPPORT
  selectedMethod: string = '';  // For UI card selection
  amountInput: number = 0;      // For quick amount + input
  displayAmount: string = "₹0.00"; // UI bindable string (optional override)
  
  is_gpayActive: boolean = false;
  is_paytmActive: boolean = false;
  is_phonepeActive: boolean = false;
  is_qrActive: boolean = false;
  is_otherActive: boolean = false;

  user_id = localStorage.getItem("user_id");
  username = localStorage.getItem("username");
  showUpiTextbox: boolean = true;
  selected_radio: any = "other";
  selectedFileName: string = "";
accountNo: string = ''; 
ifsc: string = ''; 
resetForm(): void {
    this.depositForm.reset();
    this.amountInput = 0;
    this.transactionId = '';
    this.selectedMethod = '';
    this.selectedFile = null;
    this.submitted = false;
  }
accountName: string = ''; 
  constructor(
    public dialog: MatDialog,
    private transactionService: TransactionService,
    private _location: Location,
    private fb: FormBuilder,
    private toastr: ToastrService
  ) {}

  ngOnInit(): void {
    this.generateUPIQRCode();
    this.getDepositRequests();
    this.getWithdrawRequests();

    this.transactionService.refreshDepositRequests.subscribe(() => {
      this.getDepositRequests();
    });
    this.transactionService.refreshWithdrawRequests.subscribe(() => {
      this.getWithdrawRequests();
    });

    this.depositForm = this.fb.group({
      user_id: [this.user_id, Validators.required],
      method: ["", Validators.required],
      transaction_id: ["", Validators.required],
      amount: ["", Validators.required],
      depo_proof: ["", Validators.required],
      username: [this.username, Validators.required],
    });

    this.transactionService.getUPI().subscribe((res: any) => {
      const imageBaseUrl = environment.image_url;
      console.log(res);
      if (res != null) {
        if (res.gpay) {
          this.is_gpayActive = true;
          this.gpay = res.gpay;
        }

        if (res.paytm) {
          this.is_paytmActive = true;
          this.paytm = res.paytm;
        }

        if (res.phonepe) {
          this.is_phonepeActive = true;
          this.phonepe = res.phonepe;
        }

        if (res.qrcode != "/no_file.png") {
          this.is_qrActive = true;
          this.qrcode = imageBaseUrl + res.qrcode;
        }

        if (res.account_id) {
          this.is_otherActive = true;
          this.bank = `${res.account_id}, <br> ${res.ifsc_code}, <br> ${res.bank_name}, <br> ${res.branch},  `;
          this.accountNo = res.account_id;
          this.ifsc = res.ifsc_code;
          this.accountName =res.bank_name;
        }

        switch (true) {
          case this.is_otherActive:
            this.currentPayment = this.bank;
            this.selected_radio = "other";
            break;
          case this.is_qrActive:
            this.currentPayment = `<img src="${this.qrcode}" class="w150" >`;
            this.selected_radio = "qrcode";
            break;
          case this.is_phonepeActive:
            this.currentPayment = this.phonepe;
            this.selected_radio = "phonepe";
            break;
          case this.is_paytmActive:
            this.currentPayment = this.paytm;
            this.selected_radio = "paytm";
            break;
          case this.is_gpayActive:
            this.currentPayment = this.gpay;
            this.selected_radio = "gpay";
            break;
          default:
            this.currentPayment = "No payment method found";
        }

        this.methodval = this.selected_radio;
      }
    });
  }
selectedCrypto: any = null;
// Add this interface
usdtNetworks: Array<'TRC20' | 'ERC20' | 'BEP20'> = ['TRC20', 'ERC20', 'BEP20'];

// Then define your object like this
usdtNetworkData: { [key: string]: NetworkDetails } = {
  TRC20: {
    address: 'TDKJwWWCweojFGeb6vkkrWeh2vvLpsXpVE',
    qrImage: 'https://api.100xwins.com/trc20.jpeg'
  },
  ERC20: {
    address: '0xE6D80049CcAff36CaE33Dfe23e9eB223f81e7cE9',
    qrImage: 'https://api.100xwins.com/erc20.jpeg'
  },
  BEP20: {
    address: '0xE6D80049CcAff36CaE33Dfe23e9eB223f81e7cE9',
    qrImage: 'https://api.100xwins.com/bep20.jpeg'
  }
};

// Example value (update dynamically in UI logic)
selectedUSDTNetwork: string = 'TRC20'; // Default

cryptos = [
    {
    name: 'USDT',
    address: '', // not needed since per-network addresses are used
    qrImage: ''  // not needed since per-network images are used
  },
  {
    name: 'Bitcoin',
    address: 'bc1qggdxthgruhq828s6u7pju5mq5dy7hr6fgy86ng',
    qrImage: 'https://api.100xwins.com/btcqr.jpeg'
  },
  {
    name: 'Ethereum',
    address: '0xE6D80049CcAff36CaE33Dfe23e9eB223f81e7cE9',
    qrImage: 'https://api.100xwins.com/ethernium.jpeg'
  },
  
  {
    name: 'Litecoin',
    address: '0xE6D80049CcAff36CaE33Dfe23e9eB223f81e7cE9',
    qrImage: 'https://api.100xwins.com/Litecoin.jpeg'
  }
];







  generateUPIQRCode() {
    const upiLink = `upi://pay?pa=${
      this.currentPayment
    }&pn=${encodeURIComponent(this.name)}&cu=INR`;
    QRCode.toDataURL(upiLink, { width: 250 }, (err: any, url: any) => {
      if (!err) {
        this.qrImageSrc = url;
      } else {
        console.error("QR Code generation failed", err);
      }
    });
  }

  toggleUpiTextbox() {
    this.showUpiTextbox = true;
  }

  get depositFormControl() {
    return this.depositForm.controls;
  }

  onFileSelected(event: any) {
    this.selectedFile = event.target.files[0];
    if (this.selectedFile) {
      this.selectedFileName = this.selectedFile.name;
      this.depositForm.get("depo_proof")?.setValue(this.selectedFile);
    }
  }

  chooseMethod(event: any) {
    this.selected_radio = event.target.value;
    switch (event.target.value) {
      case "paytm":
        this.currentPayment = this.paytm || "not found";
        break;
      case "phonepe":
        this.currentPayment = this.phonepe || "not found";
        break;
      case "gpay":
        this.currentPayment = this.gpay || "not found";
        break;
      case "other":
        this.currentPayment = this.bank || "not found";
        break;
      case "qrcode":
        this.currentPayment = this.qrcode
          ? `<img src="${this.qrcode}" class="w150" >`
          : "not found";
        break;
      default:
        this.currentPayment = this.gpay || "not found";
    }
    this.generateUPIQRCode();
  }

  copyMessage(val: any) {
    const selBox: any = document.createElement("textarea");
    selBox.style.position = "fixed";
    selBox.style.left = "0";
    selBox.style.top = "0";
    selBox.style.opacity = "0";

    const span = document.createElement("span");
    span.innerHTML = val;

    selBox.value = span.textContent || span.innerText;
    document.body.appendChild(selBox);
    selBox.focus();
    selBox.select();
    document.execCommand("copy");
    document.body.removeChild(selBox);
  }

  addDepositRequest() {
    const dialogRef = this.dialog.open(DepositAutopayComponent, {
      autoFocus: false,
      maxHeight: "100vh",
      disableClose: true,
    });
    dialogRef.afterClosed().subscribe(() => {
      this.getDepositRequests();
    });
  }

  addManualDepositRequest() {
    const dialogRef = this.dialog.open(DepositFormComponent, {
      autoFocus: false,
      maxHeight: "100vh",
      disableClose: true,
    });
    dialogRef.afterClosed().subscribe(() => {
      this.getDepositRequests();
    });
  }

  submitManualDepositRequest() {
    this.submitted = true;
    if (this.depositForm.invalid) return;

    const formData = new FormData();
    formData.append("user_id", this.user_id || "");
    formData.append("method", this.depositForm.value.method);
    formData.append("amount", this.depositForm.value.amount);
    formData.append("transaction_id", this.depositForm.value.transaction_id);
    formData.append("username", this.username || "");
    formData.append("file", this.selectedFile, this.selectedFile.name);

    this.transactionService.addDepositRequest(formData).subscribe((res: any) => {
      if (res.error) {
        this.errorMsg = res.error;
      } else {
        this.toastr.success("Deposit Request Sent");
        const selectedMethod = this.depositForm.value.method;
        this.depositForm.reset();
        this.depositForm.patchValue({ method: selectedMethod });
        this.submitted = false;
        this.selectedFile = null;
        this.selectedFileName = "";
      }
    });
  }

  getDepositRequests() {
    this.transactionService.getDepositRequests().subscribe((res: any) => {
      this.deposit_requests = res;
    });
  }

  getWithdrawRequests() {
    this.transactionService.getWithdrawRequests().subscribe((res: any) => {
      this.withdraw_requests = res;
    });
  }

  openDialog(type: string) {
  if (type === "deposit") {
    const dialogRef = this.dialog.open(DepositFormComponent, {
      autoFocus: false,
      maxHeight: "100vh",
      disableClose: true,
    });
    dialogRef.afterClosed().subscribe((result: any) => {
      console.log(`Deposit dialog closed: ${result}`);
    });
  } else if (type === "withdraw") {
    const dialogRef = this.dialog.open(WithdrawFormComponent, {
      autoFocus: false,
      maxHeight: "100vh",
      disableClose: true,
    });
    dialogRef.afterClosed().subscribe((result: any) => {
      console.log(`Withdraw dialog closed: ${result}`);
    });
  }
}

  selectTab(index: number): void {
    this.selectedTabIndex = index;
  }

  addAmount(amount: number) {
    this.depositAmount += amount;
  }

  clearAmount() {
    this.depositAmount = 0;
  }

  proceedDeposit() {
      
    if (this.amountInput <= 0) {
      alert("Please enter a valid deposit amount!");
      return;
    }
    this.isDepositProceed = true;
    this.transactionService.testpayment({ amount: this.amountInput }).subscribe(
      (res: any) => {
        if (res.status) {
          this.paymentUrl = res.payInfo;
          this.redirectVPA();
        } else {
          alert(res.message);
        }
        this.isDepositProceed = false;
      },
      (error) => {
        console.error("Payment API error:", error);
        alert("Something went wrong, please try again.");
        this.isDepositProceed = false;
      }
    );
  }

  redirectVPA() {
    location.href = this.paymentUrl;
  }

  backClicked() {
    this._location.back();
  }

  // 🔥 NEW METHODS MERGED HERE

  toggleMethod(method: string) {
    this.selectedMethod = method;
  }

  updateAmountInput(amount: number) {
    this.amountInput = amount;
    this.displayAmount = "₹" + (this.amountInput + 0).toFixed(2);
  }
 submitManualDepositRequest1() {
     this.isDepositProceed = true;
  const formData = new FormData();
  formData.append('user_id', this.user_id ?? '');
  formData.append('amount', this.amountInput.toString());
  formData.append('method', this.selectedMethod);
  formData.append('depo_proof', this.selectedFile);
  formData.append('transaction_id', "0987654321");
  formData.append('username', this.username || "unknown");

  this.transactionService.addManualDepositRequest(formData).subscribe({
    next: (res: any) => {
      if (res.error) {
          this.isDepositProceed = false;
        this.toastr.error(res.error);
      } else {
                    this.isDepositProceed = false;

        this.toastr.success("Deposit request submitted successfully!");
        this.resetForm();
      }
    },
    error: () => {
                  this.isDepositProceed = false;

      this.toastr.error("Something went wrong. Try again.");
    }
  });
}

onAmountChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const cleanedValue = input.value.replace(/[^\d.]/g, '');
  const numericValue = parseFloat(cleanedValue);
  this.amountInput = isNaN(numericValue) ? 0 : numericValue;
}
  get finalAmount(): string {
    return "₹" + (this.amountInput + 0).toFixed(2);
  }
  copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).then(() => {
    alert('UPI ID copied: ' + text);
  }).catch(err => {
    console.error('Failed to copy text: ', err);
  });
}

}

