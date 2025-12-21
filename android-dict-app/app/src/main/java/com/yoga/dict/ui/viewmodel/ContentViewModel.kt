package com.yoga.dict.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yoga.dict.data.repository.ContentRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ContentViewModel @Inject constructor(
    private val repository: ContentRepository
) : ViewModel() {
    
    private val _aboutProject = MutableStateFlow<String>("")
    val aboutProject: StateFlow<String> = _aboutProject.asStateFlow()
    
    private val _expertInstructions = MutableStateFlow<String>("")
    val expertInstructions: StateFlow<String> = _expertInstructions.asStateFlow()
    
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()
    
    fun loadAboutProject() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            repository.getAboutProject()
                .onSuccess { content ->
                    _aboutProject.value = content
                }
                .onFailure { e ->
                    _error.value = e.message
                }
            _isLoading.value = false
        }
    }
    
    fun loadExpertInstructions() {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            repository.getExpertInstructions()
                .onSuccess { content ->
                    _expertInstructions.value = content
                }
                .onFailure { e ->
                    _error.value = e.message
                }
            _isLoading.value = false
        }
    }
    
    fun updateAboutProject(content: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            repository.updateAboutProject(content)
                .onSuccess {
                    _aboutProject.value = content
                }
                .onFailure { e ->
                    _error.value = e.message
                }
            _isLoading.value = false
        }
    }
    
    fun updateExpertInstructions(content: String) {
        viewModelScope.launch {
            _isLoading.value = true
            _error.value = null
            repository.updateExpertInstructions(content)
                .onSuccess {
                    _expertInstructions.value = content
                }
                .onFailure { e ->
                    _error.value = e.message
                }
            _isLoading.value = false
        }
    }
}







