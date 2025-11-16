package com.yoga.dict.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.yoga.dict.data.model.Source
import com.yoga.dict.data.repository.AsanaRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class SourcesViewModel @Inject constructor(
    private val repository: AsanaRepository
) : ViewModel() {
    
    private val _sources = MutableStateFlow<List<Source>>(emptyList())
    val sources: StateFlow<List<Source>> = _sources.asStateFlow()
    
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()
    
    private val _isExpertOrAdmin = MutableStateFlow(false)
    val isExpertOrAdmin: StateFlow<Boolean> = _isExpertOrAdmin.asStateFlow()
    
    fun loadSources() {
        viewModelScope.launch {
            _isLoading.value = true
            repository.getSources()
                .onSuccess { sources ->
                    _sources.value = sources.sortedBy { it.author }
                }
                .onFailure {
                    // Handle error
                }
            _isLoading.value = false
        }
    }
    
    fun deleteSource(sourceId: String) {
        viewModelScope.launch {
            // TODO: Implement delete
            loadSources()
        }
    }
}

