# Pulp Portal

Pulp Portal is B2B version of Pulp...<!-- TODO Need to add this -->

## 🚀 Technology Stack

- **Next.js 15** with App Router
- **React 19** with TypeScript support
- **Tailwind CSS 4** for styling
- **Storybook 9** for component development
- **Vitest** for testing with browser mode
- **ESLint** and **Prettier** for code quality
- **Husky** for git hooks
- **AWS CodeArtifact** integration for private packages
- **@pulp/ui** component library integration

## 📋 Prerequisites

Before working on this project, ensure you have:

- **Node.js** (version 18 or higher)
- **npm** (latest version)
- **AWS CLI** configured with appropriate permissions for CodeArtifact
- **Git** for version control

## 🛠️ Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Pulp-Portal
```

### 2. Install Dependencies

The project automatically handles CodeArtifact authentication during installation:

```bash
npm install
```

> **Note**: The `preinstall` script automatically runs `login-codeartifact` to authenticate with AWS CodeArtifact for accessing private packages like `@pulp/ui`.

### 3. Start Development

```bash
npm run dev
```

Your application will be available at [http://localhost:3000](http://localhost:3000).

## 📚 Storybook Organization

### Stories Directory Structure

All Storybook stories **must** be placed within the `src/stories` directory following this structure:

```text
src/
├── components/
│   ├── Header/
│   │   ├── Header.tsx
│   └── Sidebar/
│       ├── Sidebar.tsx
├── pages/
│   └── HomePage/
│       ├── HomePage.tsx
│       └── HomePage.stories.tsx
└── stories/
    └── Header.stories.tsx
    └── Sidebar.stories.tsx
```

### Story File Naming Convention

Stories are automatically detected using the pattern: `**/*.stories.@(js|jsx|mjs|ts|tsx)`

**Examples of valid story files:**

- `Button.stories.tsx`
- `Card.stories.ts`
- `HomePage.stories.jsx`
- `utils.stories.js`

### Running Storybook

```bash
# Start Storybook development server
npm run storybook

# Build Storybook for production
npm run build-storybook
```

Storybook will be available at [http://localhost:6006](http://localhost:6006).

### Story Template

Here's a basic story template to get started:

```typescript
import type { Meta, StoryObj } from '@storybook/react';
import { YourComponent } from './YourComponent';

const meta: Meta<typeof YourComponent> = {
  title: 'Components/YourComponent',
  component: YourComponent,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    // Define your component props here
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    // Default props
  },
};

export const Variant: Story = {
  args: {
    // Variant props
  },
};
```

## 📁 Project Structure

```text
Pulp-Portal/
├── .storybook/              # Storybook configuration
├── public/                  # Static assets
├── scripts/                 # Build and utility scripts
│   └── login-codeartifact.js # AWS CodeArtifact authentication
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── globals.css      # Global styles
│   │   ├── layout.tsx       # Root layout
│   │   └── page.tsx         # Home page
│   └── components/          # React components
│   └── stories/             # Storybook stories directory
├── eslint.config.mjs        # ESLint configuration
├── next.config.ts           # Next.js configuration
├── package.json             # Dependencies and scripts
├── postcss.config.mjs       # PostCSS configuration
├── tsconfig.json            # TypeScript configuration
└── vitest.config.ts         # Vitest configuration
```

## 🧪 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run storybook` | Start Storybook development server |
| `npm run build-storybook` | Build Storybook for production |
| `npm run login-codeartifact` | Authenticate with AWS CodeArtifact |

## 🔧 Development Workflow

### 1. Component Development

1. Create your component in the appropriate directory under `src/components`
2. Write comprehensive stories in the stories directory
3. Use Storybook for isolated component development
4. Write tests using Vitest

### 2. Code Quality

- **Pre-commit hooks** automatically run linting and formatting
- **ESLint** enforces code standards
- **Prettier** handles code formatting
- **TypeScript** provides type safety

### 3. Testing

```bash
# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## 🏢 Integration

### Private Package Registry

This project uses AWS CodeArtifact for private company packages:

- **@pulp/ui**: Company UI component library
- Authentication is handled automatically during `npm install`
- Ensure your AWS CLI is configured with appropriate permissions

### Development Guidelines

When working on this project:

1. **Follow** the existing code style and conventions
2. **Write** comprehensive stories for new components in the stories directory
3. **Use** Storybook for isolated component development
4. **Write** tests using Vitest
5. **Ensure** all tests pass before committing

## 🔗 Useful Links

- [Next.js Documentation](https://nextjs.org/docs)
- [Storybook Documentation](https://storybook.js.org/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Vitest Documentation](https://vitest.dev/)
- [Company UI Library Storybook (@pulp/ui)](#) <!-- TODO Need to add this -->

## 🤝 Contributing

1. Follow the existing code style and conventions
2. Write stories for all new components
3. Ensure all tests pass before committing
4. Use conventional commit messages
5. Update documentation as needed

## 📄 License

This project is proprietary and intended for internal company use only.
