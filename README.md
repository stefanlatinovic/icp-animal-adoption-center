# Animal Adoption Center

This repository is a submission for the [TypeScript Smart Contract 101](https://dacade.org/communities/icp/challenges/256f0a1c-5f4f-495f-a1b3-90559ab3c51f) challenge by the Internet Computer community on [Dacade](https://dacade.org/).

## Overview

This project is a canister implementation for the Internet Computer Protocol (ICP), designed to facilitate animal adoptions. It allows users to list animals for adoption, submit adoption requests, and manage adoption listings and requests.

### Roles and functionalities

The canister is designed with a multi-role system to facilitate various operations and interactions within the adoption center ecosystem. Below are the roles defined within the system and the functionalities assigned to each.

#### Owner

- **Add employees**: The owner can add new users as employees.
- **Manage shelter capacity**: The owner can adjust the shelter's capacity.

#### Employee

- **Approve adoption requests**: Employees can review adoption requests submitted by users and approve them if they meet the shelter's criteria for adoption.
- **Reject adoption requests**: Employees can review adoption requests submitted by users and reject them if they do not meet the shelter's criteria for adoption.

#### Others

- **List animals for adoption**: Users can list animals for adoption.
- **Revoke adoption listing**: Users can revoke their animal adoption listing.
- **Submit adoption requests**: Users interested in adopting an animal can submit adoption requests.

## Getting started

Follow the steps below to set up and run the project locally.

### Prerequisites

- Node.js (v18 or later)
- DFX (v0.15.1 or later)

### Installation

1. Clone this repository:

```bash
git clone https://github.com/stefanlatinovic/icp-animal-adoption-center
```

2. Navigate to the project directory:

```bash
cd icp-animal-adoption-center
```

3. `dfx` is the tool you will use to interact with the IC locally and on mainnet. If you don't already have it installed:

```bash
npm run dfx_install
```

### Quickstart

Install dependencies, create identities, start a replica, and deploy a canister:

```bash
npm run canister_setup
```

### Interacting With Canister

The `package.json` file contains several commands starting with `canister_call` that can be used to interact with the canister.

### Tear Down

Uninstall the canister, stop the replica, remove identities, and remove dependencies:

```bash
npm run clean_state
```

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues to suggest improvements or add new features.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
