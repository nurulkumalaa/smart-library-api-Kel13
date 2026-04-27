import express from 'express';
import { LoanController } from '../controllers/loanController.js';

const router = express.Router();

// 🔥 Endpoint baru (WAJIB DITAMBAH)
router.get('/top-borrowers', LoanController.getTopBorrowers);

// Endpoint lama
router.get('/', LoanController.getLoans);
router.post('/', LoanController.createLoan);

export default router;