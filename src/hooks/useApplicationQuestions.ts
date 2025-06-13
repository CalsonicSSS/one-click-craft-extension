import { generateApplicationQuestionAnswerRequest } from '@/api/suggestionGeneration';
import type { AnsweredQuestion, ApplicationQuestionAnswerResponse } from '@/types/suggestionGeneration';
import { formatDate } from '@/utils/datetime';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

// this hook is only called / used under the ApplicationQuestion component
export const useApplicationQuestions = () => {
	const [currentTabId, setCurrentTabId] = useState<number | null>(null);
	const [questionInput, setQuestionInput] = useState('');
	const [additionalRequirementsInput, setAdditionalRequirementsInput] = useState('');
	const [tabSpecificAnsweredQuestions, setTabSpecificAnsweredQuestions] = useState<AnsweredQuestion[]>([]);
	const [questionHandlingErrMsg, setQuestionHandlingErrMsg] = useState<string>('');
	const [questionGeneratingErrMsg, setQuestionGeneratingErrMsg] = useState<string>('');

	// Get the current tab ID when the hook initializes
	useEffect(() => {
		const getCurrentTabId = async () => {
			try {
				const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
				if (tabs[0]?.id) {
					setCurrentTabId(tabs[0].id);
				}
			} catch (err) {
				console.error('Error getting current tab ID:', err);
				setQuestionHandlingErrMsg('Error getting current tab ID');
			}
		};
		getCurrentTabId();
	}, []);

	// load initial tab specific answered questions
	useEffect(() => {
		const loadTabSpecificQuestions = async () => {
			if (!currentTabId) return;

			try {
				const allAnsweredQuestionsResultPair = await chrome.storage.local.get('allAnsweredQuestions');
				if (!allAnsweredQuestionsResultPair.allAnsweredQuestions) {
					setTabSpecificAnsweredQuestions([]);
				} else if (
					allAnsweredQuestionsResultPair.allAnsweredQuestions &&
					allAnsweredQuestionsResultPair.allAnsweredQuestions[currentTabId]
				) {
					setTabSpecificAnsweredQuestions(allAnsweredQuestionsResultPair.allAnsweredQuestions[currentTabId]);
				} else {
					setTabSpecificAnsweredQuestions([]);
				}
			} catch (err) {
				console.error('Error loading tab-specific application questions:', err);
				setQuestionHandlingErrMsg('Failed to load saved questions');
			}
		};

		loadTabSpecificQuestions();
	}, [currentTabId]);

	const saveQuestion = async (answeredQuestion: AnsweredQuestion): Promise<void> => {
		if (!currentTabId) return;

		try {
			setQuestionHandlingErrMsg('');

			// update tabSpecificAnsweredQuestions state
			const updatedTabAnsweredQuestions = [answeredQuestion, ...tabSpecificAnsweredQuestions];
			setTabSpecificAnsweredQuestions(updatedTabAnsweredQuestions);

			// update storage
			const allAnsweredQuestionsResultPair = await chrome.storage.local.get('allAnsweredQuestions');
			const allAnsweredQuestions =
				(allAnsweredQuestionsResultPair.allAnsweredQuestions as Record<string, AnsweredQuestion[]>) || {};
			allAnsweredQuestions[currentTabId] = updatedTabAnsweredQuestions;
			await chrome.storage.local.set({ allAnsweredQuestions });
		} catch (err) {
			console.error('Error saving application question:', err);
			setQuestionHandlingErrMsg('Failed to save and update answered question');
		}
	};

	const deleteQuestion = async (id: string): Promise<void> => {
		if (!currentTabId) return;

		try {
			setQuestionHandlingErrMsg('');

			// update tabSpecificAnsweredQuestions state
			const updatedTabAnsweredQuestions = tabSpecificAnsweredQuestions.filter((q) => q.id !== id);
			setTabSpecificAnsweredQuestions(updatedTabAnsweredQuestions);

			// update storage
			const allAnsweredQuestionsResultPair = await chrome.storage.local.get('allAnsweredQuestions');
			const allAnsweredQuestions =
				(allAnsweredQuestionsResultPair.allAnsweredQuestions as Record<string, AnsweredQuestion[]>) || {};
			allAnsweredQuestions[currentTabId] = updatedTabAnsweredQuestions;
			await chrome.storage.local.set({ allAnsweredQuestions });
		} catch (err) {
			console.error('Error deleting application question:', err);
			setQuestionHandlingErrMsg('Failed to delete answered question');
		}
	};

	// Generate answer mutation
	const mutation = useMutation({
		mutationFn: generateApplicationQuestionAnswerRequest,
		onSuccess: async (data: ApplicationQuestionAnswerResponse) => {
			const newAnsweredQuestion: AnsweredQuestion = {
				id: crypto.randomUUID(),
				question: data.question,
				additionalRequirements: additionalRequirementsInput.trim() || undefined,
				answer: data.answer,
				createdAt: formatDate(new Date()),
			};

			await saveQuestion(newAnsweredQuestion);
			setQuestionInput('');
			setAdditionalRequirementsInput('');
			setQuestionGeneratingErrMsg('');
		},
		onError: (error) => {
			setQuestionGeneratingErrMsg(error.message);
		},
	});

	return {
		questionInput,
		setQuestionInput,
		additionalRequirementsInput,
		setAdditionalRequirementsInput,
		tabSpecificAnsweredQuestions,
		deleteQuestion,
		questionHandlingErrMsg,
		questionGeneratingErrMsg,
		mutation,
	};
};
