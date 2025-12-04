package com.yoga.dict.ui.screens

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.yoga.dict.data.model.Asana
import com.yoga.dict.data.model.AsanaPhoto
import com.yoga.dict.ui.viewmodel.AsanaViewModel
import com.yoga.dict.ui.viewmodel.AsanaUiState
import com.yoga.dict.ui.viewmodel.AuthViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AsanaDetailScreen(
    asanaId: String,
    onBack: () -> Unit,
    onNavigateToAsana: (String) -> Unit = {},
    viewModel: AsanaViewModel = hiltViewModel(),
    authViewModel: AuthViewModel = hiltViewModel()
) {
    val context = LocalContext.current
    
    LaunchedEffect(asanaId) {
        viewModel.loadAsanaById(asanaId)
    }
    
    val selectedAsana by viewModel.selectedAsana.collectAsStateWithLifecycle()
    val similarAsanas by viewModel.similarAsanas.collectAsStateWithLifecycle()
    val allAsanas by viewModel.asanaList.collectAsStateWithLifecycle()
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val isExpertOrAdmin = authViewModel.isExpertOrAdmin
    
    var showMatchDialog by remember { mutableStateOf(false) }
    var matchSearchQuery by remember { mutableStateOf("") }
    var selectedMatchAsana by remember { mutableStateOf<Asana?>(null) }
    
    // Для обычных пользователей - загружаем аналогичные асаны для всех асан с таким же названием
    var similarAsanasMap by remember { mutableStateOf(mapOf<String, List<Asana>>()) }
    
    LaunchedEffect(selectedAsana, allAsanas, isExpertOrAdmin) {
        if (!isExpertOrAdmin && selectedAsana != null && allAsanas.isNotEmpty()) {
            val asanaName = selectedAsana!!.name.name_ru.lowercase().trim()
            val asanasWithSameName = allAsanas.filter { 
                it.name.name_ru.lowercase().trim() == asanaName 
            }
            
            // Загружаем аналогичные асаны для каждой асаны с таким же названием параллельно
            val map = mutableMapOf<String, List<Asana>>()
            kotlinx.coroutines.coroutineScope {
                asanasWithSameName.map { a ->
                    async {
                        val similar = viewModel.getSimilarAsanasForAsana(a.id)
                        if (similar.isNotEmpty()) {
                            a.id to similar
                        } else {
                            null
                        }
                    }
                }.awaitAll().forEach { result ->
                    result?.let { (id, similar) ->
                        map[id] = similar
                    }
                }
            }
            similarAsanasMap = map.toMap()
        }
    }
    
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Детали асаны") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Назад")
                    }
                },
                actions = {
                    IconButton(onClick = { /* TODO: Поделиться */ }) {
                        Icon(Icons.Default.Share, contentDescription = "Поделиться")
                    }
                    IconButton(onClick = { /* TODO: Избранное */ }) {
                        Icon(Icons.Default.FavoriteBorder, contentDescription = "Избранное")
                    }
                }
            )
        }
    ) { paddingValues ->
        when (uiState) {
            is AsanaUiState.Loading -> {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(paddingValues),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }
            is AsanaUiState.Error -> {
                val errorState = uiState as AsanaUiState.Error
                ErrorMessage(
                    message = errorState.message,
                    onRetry = { viewModel.loadAsanaById(asanaId) },
                    modifier = Modifier.padding(paddingValues)
                )
            }
            is AsanaUiState.Success -> {
                selectedAsana?.let { asana ->
                    AsanaDetailContent(
                        asana = asana,
                        allAsanas = allAsanas,
                        similarAsanas = similarAsanas,
                        isExpertOrAdmin = isExpertOrAdmin,
                        onMatchClick = { showMatchDialog = true },
                        onRemoveSimilar = { targetId ->
                            viewModel.removeSameAsObject(
                                targetAsanaId = targetId,
                                onSuccess = {
                                    Toast.makeText(context, "Связь удалена", Toast.LENGTH_SHORT).show()
                                },
                                onError = { error ->
                                    Toast.makeText(context, error, Toast.LENGTH_SHORT).show()
                                }
                            )
                        },
                        onNavigateToAsana = onNavigateToAsana,
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(paddingValues)
                    )
                }
            }
        }
    }
    
    // Диалог выбора асаны для совпадения
    if (showMatchDialog) {
        val filteredAsanas = allAsanas.filter { asana ->
            asana.id != selectedAsana?.id &&
            (matchSearchQuery.isBlank() ||
             asana.name.name_ru.contains(matchSearchQuery, ignoreCase = true) ||
             asana.name.name_sanskrit?.contains(matchSearchQuery, ignoreCase = true) == true)
        }.take(20)
        
        AlertDialog(
            onDismissRequest = { 
                showMatchDialog = false
                matchSearchQuery = ""
                selectedMatchAsana = null
            },
            title = { Text("Указать совпадение") },
            text = {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 400.dp)
                ) {
                    OutlinedTextField(
                        value = matchSearchQuery,
                        onValueChange = { matchSearchQuery = it },
                        placeholder = { Text("Поиск асаны...") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        filteredAsanas.forEach { asana ->
                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { selectedMatchAsana = asana },
                                colors = CardDefaults.cardColors(
                                    containerColor = if (selectedMatchAsana?.id == asana.id)
                                        MaterialTheme.colorScheme.primaryContainer
                                    else
                                        MaterialTheme.colorScheme.surface
                                )
                            ) {
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(8.dp),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    asana.photos.firstOrNull()?.let { photo ->
                                        AsyncImage(
                                            model = ImageRequest.Builder(LocalContext.current)
                                                .data(photo.url)
                                                .crossfade(true)
                                                .build(),
                                            contentDescription = null,
                                            modifier = Modifier
                                                .size(40.dp)
                                                .clip(RoundedCornerShape(6.dp)),
                                            contentScale = ContentScale.Crop
                                        )
                                    }
                                    
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = asana.name.displayName,
                                            style = MaterialTheme.typography.bodyMedium,
                                            fontWeight = FontWeight.Bold,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis
                                        )
                                        asana.sources.firstOrNull()?.let { source ->
                                            Text(
                                                text = source.displayName,
                                                style = MaterialTheme.typography.bodySmall,
                                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis
                                            )
                                        }
                                    }
                                }
                            }
                        }
                        
                        if (filteredAsanas.isEmpty()) {
                            Text(
                                text = "Асаны не найдены",
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.padding(16.dp)
                            )
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        selectedMatchAsana?.let { target ->
                            viewModel.setSameAsObject(
                                targetAsanaId = target.id,
                                onSuccess = {
                                    Toast.makeText(context, "Совпадение указано", Toast.LENGTH_SHORT).show()
                                    showMatchDialog = false
                                    matchSearchQuery = ""
                                    selectedMatchAsana = null
                                },
                                onError = { error ->
                                    Toast.makeText(context, error, Toast.LENGTH_SHORT).show()
                                }
                            )
                        }
                    },
                    enabled = selectedMatchAsana != null
                ) {
                    Text("Указать")
                }
            },
            dismissButton = {
                TextButton(
                    onClick = {
                        showMatchDialog = false
                        matchSearchQuery = ""
                        selectedMatchAsana = null
                    }
                ) {
                    Text("Отмена")
                }
            }
        )
    }
}

@Composable
fun AsanaDetailContent(
    asana: Asana,
    allAsanas: List<Asana>,
    similarAsanas: List<Asana>,
    isExpertOrAdmin: Boolean,
    onMatchClick: () -> Unit,
    onRemoveSimilar: (String) -> Unit,
    onNavigateToAsana: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
    ) {
        // Информация
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Название
            Text(
                text = asana.name.displayName,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold
            )
            
            // Санскрит
            asana.name.name_sanskrit?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.titleLarge,
                    color = MaterialTheme.colorScheme.primary
                )
            }
            
            // Транслитерация
            asana.name.transliteration?.let {
                Text(
                    text = it,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            
            // Перевод
            asana.name.definition?.let {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                    )
                ) {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(16.dp)
                    )
                }
            }
        }
        
        // Для обычных пользователей - показываем асаны по отдельности (как у админа)
        if (!isExpertOrAdmin) {
            val asanaName = asana.name.name_ru.lowercase().trim()
            val asanasWithSameName = allAsanas.filter { 
                it.name.name_ru.lowercase().trim() == asanaName
            }
            
            // Берем информацию о названии из первой асаны (они все с одинаковым названием)
            val firstAsana = asanasWithSameName.firstOrNull()
            
            // Информация о названии показывается один раз сверху
            if (firstAsana != null) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    // Санскрит
                    firstAsana.name.name_sanskrit?.let {
                        Text(
                            text = it,
                            style = MaterialTheme.typography.titleLarge,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                    
                    // Транслитерация
                    firstAsana.name.transliteration?.let {
                        Text(
                            text = it,
                            style = MaterialTheme.typography.bodyLarge,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    
                    // Перевод
                    firstAsana.name.definition?.let {
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.surfaceVariant
                            )
                        ) {
                            Text(
                                text = it,
                                style = MaterialTheme.typography.bodyMedium,
                                modifier = Modifier.padding(16.dp)
                            )
                        }
                    }
                }
                
                Spacer(modifier = Modifier.height(16.dp))
            }
            
            // Показываем каждую асану отдельно
            asanasWithSameName.forEach { currentAsana ->
                // Загружаем аналогичные асаны для этой асаны
                val similarForThisAsana = similarAsanasMap[currentAsana.id] ?: emptyList()
                val filteredSimilar = similarForThisAsana.filter { similar ->
                    val similarName = similar.name.name_ru.lowercase().trim()
                    similarName != asanaName
                }
                
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    // Источник
                    if (currentAsana.sources.isNotEmpty()) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 16.dp),
                            verticalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Text(
                                text = "Источник:",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold
                            )
                            currentAsana.sources.forEach { source ->
                                Card(
                                    modifier = Modifier.fillMaxWidth(),
                                    colors = CardDefaults.cardColors(
                                        containerColor = MaterialTheme.colorScheme.primaryContainer
                                    )
                                ) {
                                    Column(modifier = Modifier.padding(12.dp)) {
                                        Text(
                                            text = source.title,
                                            style = MaterialTheme.typography.titleSmall,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Text(
                                            text = "${source.author}${source.year?.let { " ($it)" } ?: ""}",
                                            style = MaterialTheme.typography.bodySmall
                                        )
                                    }
                                }
                            }
                        }
                    }
                    
                    // Фото
                    if (currentAsana.photos.isNotEmpty()) {
                        LazyRow(
                            modifier = Modifier.fillMaxWidth(),
                            contentPadding = PaddingValues(16.dp),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            items(currentAsana.photos) { photo ->
                                AsyncImage(
                                    model = ImageRequest.Builder(LocalContext.current)
                                        .data(photo.url)
                                        .crossfade(true)
                                        .build(),
                                    contentDescription = currentAsana.name.displayName,
                                    modifier = Modifier
                                        .size(300.dp)
                                        .clip(RoundedCornerShape(16.dp)),
                                    contentScale = ContentScale.Crop
                                )
                            }
                        }
                    }
                    
                    // Аналогичные асаны для этой асаны (как у админа)
                    if (filteredSimilar.isNotEmpty()) {
                        Spacer(modifier = Modifier.height(16.dp))
                        Box(modifier = Modifier.padding(horizontal = 16.dp)) {
                            SimilarAsanasSection(
                                similarAsanas = filteredSimilar,
                                isExpertOrAdmin = false,
                                onRemoveSimilar = {},
                                onNavigateToAsana = onNavigateToAsana
                            )
                        }
                    }
                }
                
                // Разделитель между асанами
                if (currentAsana.id != asanasWithSameName.last().id) {
                    HorizontalDivider(
                        modifier = Modifier.padding(vertical = 16.dp),
                        thickness = 2.dp,
                        color = MaterialTheme.colorScheme.outlineVariant
                    )
                }
            }
        } else {
            // Для админов/экспертов - обычная галерея фото
            if (asana.photos.isNotEmpty()) {
                LazyRow(
                    modifier = Modifier.fillMaxWidth(),
                    contentPadding = PaddingValues(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    items(asana.photos) { photo ->
                        AsyncImage(
                            model = ImageRequest.Builder(LocalContext.current)
                                .data(photo.url)
                                .crossfade(true)
                                .build(),
                            contentDescription = asana.name.displayName,
                            modifier = Modifier
                                .size(300.dp)
                                .clip(RoundedCornerShape(16.dp)),
                            contentScale = ContentScale.Crop
                        )
                    }
                }
            }
            
            // Источник (только для админов/экспертов)
            if (asana.sources.isNotEmpty()) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        text = "Источник:",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold
                    )
                    asana.sources.forEach { source ->
                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(
                                containerColor = MaterialTheme.colorScheme.primaryContainer
                            )
                        ) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text(
                                    text = source.title,
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.Bold
                                )
                                Text(
                                    text = source.author,
                                    style = MaterialTheme.typography.bodyMedium
                                )
                                source.year?.let {
                                    Text(
                                        text = "Год: $it",
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                }
                            }
                        }
                    }
                }
            }
            
            // Кнопка "Указать совпадение" для админов/экспертов
            Button(
                onClick = onMatchClick,
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color(0xFFFBBF24)
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
            ) {
                Icon(Icons.Default.Link, contentDescription = null)
                Spacer(modifier = Modifier.width(8.dp))
                Text("Указать совпадение", color = Color(0xFF92400E))
            }
            
            // Аналогичные асаны для админов/экспертов
            if (similarAsanas.isNotEmpty()) {
                Spacer(modifier = Modifier.height(16.dp))
                Box(modifier = Modifier.padding(horizontal = 16.dp)) {
                    SimilarAsanasSection(
                        similarAsanas = similarAsanas,
                        isExpertOrAdmin = true,
                        onRemoveSimilar = onRemoveSimilar,
                        onNavigateToAsana = onNavigateToAsana
                    )
                }
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
    }
}

@Composable
fun SimilarAsanasSection(
    similarAsanas: List<Asana>,
    isExpertOrAdmin: Boolean,
    onRemoveSimilar: (String) -> Unit,
    onNavigateToAsana: (String) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        ),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    Icons.Default.Link,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = "Данная асана в других источниках",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.primary
                )
            }
            
            similarAsanas.forEach { similar ->
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onNavigateToAsana(similar.id) },
                    colors = CardDefaults.cardColors(
                        containerColor = Color.White
                    )
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(8.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        similar.photos.firstOrNull()?.let { photo ->
                            AsyncImage(
                                model = ImageRequest.Builder(LocalContext.current)
                                    .data(photo.url)
                                    .crossfade(true)
                                    .build(),
                                contentDescription = null,
                                modifier = Modifier
                                    .size(40.dp)
                                    .clip(RoundedCornerShape(6.dp)),
                                contentScale = ContentScale.Crop
                            )
                        }
                        
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = similar.name.displayName,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = FontWeight.Bold
                            )
                            // Источник для всех пользователей
                            similar.sources.firstOrNull()?.let { source ->
                                Text(
                                    text = "${source.author} - ${source.title}${source.year?.let { " ($it)" } ?: ""}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant
                                )
                            }
                        }
                        
                        // Кнопка удаления только для админов/экспертов
                        if (isExpertOrAdmin) {
                            IconButton(
                                onClick = { onRemoveSimilar(similar.id) }
                            ) {
                                Icon(
                                    Icons.Default.Close,
                                    contentDescription = "Удалить связь",
                                    tint = Color(0xFFEF4444)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
