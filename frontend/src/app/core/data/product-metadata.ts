// Version-controlled descriptions for fictional demo labels, not verified manufacturer specifications.
const descriptions: Record<string, string> = {
"Notebook Air 13": "A compact 13-inch-class laptop concept for mobile office work and light presentations.",
"Notebook Pro 14": "A 14-inch-class laptop concept for multitasking, documents and video meetings.",
"Notebook Work 15": "A 15-inch-class laptop concept for everyday desk work and spreadsheets.",
"Notebook Study 14": "A 14-inch-class student laptop concept for research, notes and online lessons.",
"Notebook Mobile 16": "A 16-inch-class laptop concept for working with larger documents on the move.",
"Monitor 22 FHD": "A 22-inch-class Full HD display concept for a compact workstation.",
"Monitor 24 FHD": "A 24-inch-class Full HD display concept for everyday office applications.",
"Monitor 27 QHD": "A 27-inch-class QHD display concept for viewing multiple windows.",
"Monitor 32 UHD": "A 32-inch-class UHD display concept for larger work areas and detailed content.",
"Monitor 29 Wide": "A 29-inch-class wide-format display concept for side-by-side documents.",
"Wireless Mouse": "A cordless pointing-device concept for a flexible workstation.",
"USB Keyboard": "A wired USB keyboard concept for routine typing at an office desk.",
"Webcam HD": "An HD webcam concept for online meetings and remote collaboration.",
"USB Hub": "A USB hub concept for connecting multiple peripherals to one workstation.",
"Laptop Stand": "A raised laptop stand concept for positioning a notebook on a desk.",
"Gigabit Router": "A gigabit router concept for connecting an office network to external services.",
"Wi-Fi Access Point": "A wireless access point concept for connecting office devices over Wi-Fi.",
"Network Switch 8 Port": "An eight-port network switch concept for a small wired workgroup.",
"Network Switch 24 Port": "A 24-port network switch concept for a larger wired office network.",
"Ethernet Cable 5m": "A five-metre Ethernet cable concept for connecting network equipment.",
"SSD 256GB": "A 256 GB solid-state storage concept for a basic workstation.",
"SSD 512GB": "A 512 GB solid-state storage concept for a general office computer.",
"SSD 1TB": "A 1 TB solid-state storage concept for a larger local file collection.",
  "USB Drive 64GB": "A 64 GB removable USB storage concept for transferring files.",
"External Drive 2TB": "A 2 TB external drive concept for storing larger project files.",
"Laser Printer Mono": "A monochrome laser printer concept for routine office documents.",
"Laser Printer Color": "A colour laser printer concept for presentations and mixed office documents.",
"Inkjet Printer": "An inkjet printer concept for mixed text and colour office materials.",
"Document Scanner": "A document scanner concept for converting paper records into digital files.",
"Label Printer": "A label printer concept for organising packages and inventory.",
"Office Desk": "A desk concept providing a work surface for a computer and paperwork.",
"Ergo Mesh Office Chair": "A mesh-backed office chair concept for a workstation seating area.",
"Filing Cabinet": "A filing cabinet concept for organising paper records in an office.",
"Meeting Table": "A meeting table concept for shared discussions and collaborative work.",
"Mobile Pedestal": "A mobile under-desk storage pedestal concept for office supplies.",
"Paper A4 Box": "A boxed A4 paper concept for routine printing and copying.",
"Notebook Pack": "A pack of paper notebooks for notes during meetings and planning.",
"Pen Pack": "A multipack of writing pens for shared office use.",
"Stapler": "A desk stapler concept for fastening small sets of paper.",
"Document Folder Pack": "A pack of document folders for organising paper records.",
"Office Headset": "A headset concept for calls and everyday office audio.",
"Conference Speaker": "A conference speaker concept for group calls in meeting rooms.",
"Desktop Speakers": "A pair of desktop speaker concepts for workstation audio.",
"USB Microphone": "A USB microphone concept for voice calls and basic recording.",
"Wireless Headphones": "A cordless headphone concept for listening without a desk cable.",
"UPS 650VA": "A 650 VA uninterruptible power supply concept for small office equipment.",
"UPS 1000VA": "A 1000 VA uninterruptible power supply concept for a larger workstation setup.",
"Surge Protector": "A surge-protector concept for connecting office equipment to mains power.",
"Power Strip": "A multi-outlet power strip concept for distributing power at a desk.",
"Laptop Charger": "A laptop charger concept; connector and device compatibility require confirmation.",
"Notebook Campus 13": "A 13-inch-class laptop concept for taking notes and working between classrooms.",
"Monitor 25 QHD": "A 25-inch-class QHD monitor concept for a compact multi-window workstation.",
"Ergonomic Mouse": "A pointing-device concept shaped for a more comfortable desk setup.",
"Wi-Fi Mesh Node": "A wireless mesh-node concept for extending coverage within an office.",
"External SSD 1TB": "A 1 TB external solid-state storage concept for portable project files.",
};

const demoPrefix = /^(?:\[DEMO\]|\[JEDEL FICTIONAL\])\s+/;
export function isDemoProduct(name: string): boolean { return demoPrefix.test(name); }
export function catalogNamePrefix(name: string): string { return name.match(demoPrefix)?.[0] ?? ''; }
export function displayCatalogName(name: string): string { return name.replace(demoPrefix, ''); }
export { displayCatalogName as displayProductName };
export function displayProductText(text: string): string { return text.replace(/\[(?:DEMO|JEDEL FICTIONAL)\]\s+/g, ''); }
export function demoProductDescription(name: string): string | undefined {
  return isDemoProduct(name) ? descriptions[displayCatalogName(name)] : undefined;
}

// Earlier catalog examples have no demo marker. Require all three fields to
// match the pre-existing sample metadata so unrelated records are not matched.
const legacyDescriptions: Record<number, {name: string; category: string; description: string}> = {
  1: {name: 'Laptop Dell', category: 'Electronics', description: 'Laptop for portable office work; model specifications are not recorded.'},
  2: {name: 'Office Monitor', category: 'Electronics', description: 'External display for a desktop or laptop workstation; specifications are not recorded.'},
  3: {name: 'Wireless Keyboard', category: 'Accessories', description: 'Wireless keyboard for everyday typing at an office workstation.'},
  4: {name: 'Office Chair', category: 'Furniture', description: 'Desk chair for office workstations and shared workspaces.'},
  5: {name: 'Network Router', category: 'Networking', description: 'Router for connecting devices on an office network; specifications are not recorded.'},
};
export function legacyProductDescription(id: number, name: string, category: string): string | undefined {
  const record = legacyDescriptions[id];
  return record?.name === name && record.category === category ? record.description : undefined;
}
