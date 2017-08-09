export interface Profile {
  $key: string
  email: string
  fullName: string
  intro: string
  isAdmin: boolean
  isConfirmed: boolean
  phone: string
  portraitUrl: string
  skills: string
  uid: string
  isEAP?: boolean
}

export interface GatewayCustomer {
  $key: string
  profileKey: string
  gatewayId: string
}

export interface Commitment {
  $key: string
  code: string
  oppKey: string
  party: string
  count?: string
  amount?: string
  eventCode?: string
  ticketType?: string
}

export interface Engagement {
  $key: string
  answer: string
  assignmentCount: number
  declined: boolean
  isAccepted: boolean
  isApplied: boolean
  isAssigned: boolean
  isConfirmed: boolean
  isPaid: boolean
  oppKey: string
  payment: {
    clientToken: string
    gatewayId: string
    transactionId?: string
    subscriptionId?: string
    error?: boolean
    amountPaid?: string
    paidAt?: number
  }
  depositAmount?: string
  isDepositPaid?: boolean
  deposit?: {
    billingDate?: string
    paymentError?: string
  }
  paymentClientToken?: string // deprecated
  paymentError?: boolean // deprecated
  priority: boolean
  profileKey: string
}

// Such as
// Opportunities :: HashMap(Key, Opportunity)
// export type Opportunities = HashMap()
export interface Opportunity {
  authorProfilekey: string;
  confirmationsOn: boolean;
  description: string;
  isPublic: boolean;
  name: string;
  project: Project;
  projectKey: string;
  question: string;
}

export interface Project {
  description: string
  name: string
  ownerProfileKey: string
}

export interface Team {
  authorProfileKey: string;
  description: string;
  name: string;
  project: Project;
  projectKey: string;
  question: string;
}

export interface Teams {
  [teamKey: string]: Team
}

// TODO : move UserApplication here
