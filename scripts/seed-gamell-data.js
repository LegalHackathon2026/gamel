// scripts/seed-gamell-data.js
// Seed the database with sample scenarios and flashcards for Gamell

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const scenarios = [
  {
    title: "Contract Breach Scenario",
    description: "A small business owner discovers their supplier has delivered defective goods. What legal steps should they take?",
    situation: "You run a small bakery and ordered 100kg of flour from a local supplier. When the flour arrives, you discover it's contaminated with insects and cannot be used. The supplier refuses to refund your money or provide replacement flour. What should you do?",
    choices: [
      {
        text: "Accept the situation and find a new supplier",
        outcome: "While this might be the path of least resistance, you may be entitled to compensation for the breach of contract.",
        explanation: "Under Nigerian contract law, when one party fails to perform their obligations (breach of contract), the innocent party is entitled to remedies including damages, specific performance, or rescission of the contract.",
        xp_reward: 5
      },
      {
        text: "Send a formal demand letter to the supplier",
        outcome: "This is a good first step in resolving the dispute through negotiation before escalating to legal action.",
        explanation: "A formal demand letter puts the breaching party on notice of the breach and your intention to seek remedies. This creates evidence of the dispute and may lead to an amicable resolution.",
        xp_reward: 10
      },
      {
        text: "Immediately sue the supplier in court",
        outcome: "While you have the right to sue, litigation should generally be a last resort due to time and cost involved.",
        explanation: "Courts prefer that parties attempt to resolve disputes through alternative dispute resolution methods first. However, if the amount in dispute justifies it, you can file a suit in the appropriate court.",
        xp_reward: 5
      }
    ],
    correct_choice: 1,
    legal_topic: "Contract Law",
    difficulty: "beginner",
    xp_reward: 10
  },
  {
    title: "Employment Termination",
    description: "An employee is suddenly terminated without notice. What are their rights?",
    situation: "You've worked at a company for 3 years when your boss suddenly tells you that you're fired, effective immediately. No reason is given, and you're not allowed to return to your desk to collect your belongings. What are your rights in this situation?",
    choices: [
      {
        text: "Accept the termination and leave quietly",
        outcome: "You may be entitled to notice pay or other benefits depending on your contract and length of service.",
        explanation: "Under Nigerian labor law, employees are entitled to reasonable notice or payment in lieu of notice. The length of notice depends on the employee's position and years of service.",
        xp_reward: 5
      },
      {
        text: "Demand to know the reason for termination",
        outcome: "You have the right to know the reason for termination, especially if you suspect it's unfair or discriminatory.",
        explanation: "The Nigerian Constitution and labor laws protect employees from arbitrary termination. If the termination is wrongful, you may be entitled to reinstatement or damages.",
        xp_reward: 10
      },
      {
        text: "File a police report for trespassing",
        outcome: "This is not the appropriate legal remedy for wrongful termination.",
        explanation: "Wrongful termination is a civil matter, not criminal. You should seek redress through the labor courts or industrial arbitration panel, not the police.",
        xp_reward: 5
      }
    ],
    correct_choice: 1,
    legal_topic: "Employment Law",
    difficulty: "intermediate",
    xp_reward: 15
  },
  {
    title: "Consumer Protection",
    description: "A customer buys a defective product. What recourse do they have?",
    situation: "You purchased an expensive smartphone from an electronics store. After 2 weeks, the phone stops working completely. When you return to the store, they refuse to repair or replace it, claiming it's your fault. What can you do?",
    choices: [
      {
        text: "Throw away the phone and buy a new one",
        outcome: "You may be entitled to a refund, repair, or replacement under consumer protection laws.",
        explanation: "The Nigerian Consumer Protection Council provides remedies for defective products, including the right to return goods within a reasonable time if they don't meet acceptable quality standards.",
        xp_reward: 5
      },
      {
        text: "Contact the Consumer Protection Council",
        outcome: "This is an excellent first step to resolve your consumer complaint.",
        explanation: "The Consumer Protection Council (CPC) is empowered to investigate consumer complaints and can order businesses to provide remedies including refunds, repairs, or replacements for defective products.",
        xp_reward: 10
      },
      {
        text: "Sue the store immediately in court",
        outcome: "While you can sue, administrative remedies through the CPC are often faster and less expensive.",
        explanation: "The CPC provides an alternative dispute resolution mechanism that's often quicker and less formal than court litigation. Court action should be considered if the CPC process fails.",
        xp_reward: 5
      }
    ],
    correct_choice: 1,
    legal_topic: "Consumer Law",
    difficulty: "beginner",
    xp_reward: 10
  }
];

const flashcards = [
  {
    question: "What is the supreme law of Nigeria?",
    answer: "The Constitution of the Federal Republic of Nigeria 1999 (as amended). It establishes the framework for government, defines fundamental rights, and provides the legal basis for all other laws.",
    legal_topic: "Constitutional Law",
    difficulty: "beginner"
  },
  {
    question: "What are the three arms of government in Nigeria?",
    answer: "The Executive, Legislature, and Judiciary. The Executive implements laws, the Legislature makes laws, and the Judiciary interprets laws.",
    legal_topic: "Constitutional Law",
    difficulty: "beginner"
  },
  {
    question: "What is the difference between a crime and a tort?",
    answer: "A crime is an offense against the state/society punishable by the state. A tort is a civil wrong against an individual that gives rise to a legal action for damages or injunction.",
    legal_topic: "Criminal Law",
    difficulty: "intermediate"
  },
  {
    question: "What is the statute of limitations for contract disputes in Nigeria?",
    answer: "Generally 6 years from when the cause of action arose, under the Limitation Law of each state. However, this can vary depending on the type of contract and jurisdiction.",
    legal_topic: "Contract Law",
    difficulty: "intermediate"
  },
  {
    question: "What constitutes valid consent in contract law?",
    answer: "Consent must be free (not obtained through coercion, undue influence, fraud, or misrepresentation), informed, and given by someone with capacity to contract.",
    legal_topic: "Contract Law",
    difficulty: "intermediate"
  },
  {
    question: "What are the grounds for divorce under Nigerian law?",
    answer: "Adultery, cruelty, desertion for at least one year, imprisonment for 7+ years, insanity, or if the marriage has broken down irretrievably. Requirements vary by jurisdiction.",
    legal_topic: "Family Law",
    difficulty: "advanced"
  }
];

async function seedData() {
  console.log('🌱 Starting Gamell data seeding...');

  try {
    // Seed scenarios
    console.log('📚 Seeding scenarios...');
    for (const scenario of scenarios) {
      const { data, error } = await supabase
        .from('scenarios')
        .insert(scenario)
        .select();

      if (error) {
        console.error('Error seeding scenario:', scenario.title, error);
      } else {
        console.log('✅ Seeded scenario:', scenario.title);
      }
    }

    // Seed flashcards
    console.log('🎴 Seeding flashcards...');
    for (const flashcard of flashcards) {
      const { data, error } = await supabase
        .from('flashcards')
        .insert(flashcard)
        .select();

      if (error) {
        console.error('Error seeding flashcard:', flashcard.question, error);
      } else {
        console.log('✅ Seeded flashcard:', flashcard.question.substring(0, 50) + '...');
      }
    }

    console.log('🎉 Gamell data seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error during seeding:', error);
    process.exit(1);
  }
}

// Run the seeding
seedData();