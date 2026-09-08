export interface Technician {
  id?: string;
  name: string;
  ci: string;
  phone: string;
  email: string;
}

export interface Client {
  id?: string;
  name: string;
  ciRif: string;
  phone: string;
  email: string;
}

export interface Equipment {
  type: string;
  otherType?: string;
  brandModel: string;
  color: string;
  serialNumber: string;
  accessories: string[];
  otherAccessory?: string;
  username?: string;
  password?: string;
}

export interface InspectionItem {
  status: string[];
  notes: string;
}

export interface Inspection {
  power: InspectionItem;
  screen: InspectionItem;
  keyboard: InspectionItem;
  ports: InspectionItem;
  chassis: InspectionItem;
  opticalDrive: InspectionItem;
}

export interface ServiceJob {
  reportedFailure: string;
  services: string[];
  backupRequired: boolean;
  backupRoute?: string;
  backupPriority?: string;
  hasPartsReplacement?: boolean;
  partsRequested?: string;
}

export interface Order {
  id?: string;
  orderNumber: string;
  technicianId?: string;
  technicianName?: string;
  technicianCi?: string;
  date: string;
  time: string;
  client: Client;
  equipment: Equipment;
  inspection: Inspection;
  serviceJob: ServiceJob;
  status: string;
  fichaRegistrada?: boolean;
  fichaUrl?: string;
}

export interface PricingItem {
  id?: string;
  service: string;
  priceUSD: number;
}
